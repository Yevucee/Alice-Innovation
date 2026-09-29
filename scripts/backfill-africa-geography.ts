import { closePool, getPool } from "@alice/database";
import { AFRICA_SOURCE_GEO_DEFAULTS, countryCodeFor } from "@alice/taxonomy";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function ensureLocation(
  pool: ReturnType<typeof getPool>,
  name: string,
  code: string | null,
  continent: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO locations (country_name, country_code, continent)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM locations
       WHERE country_name = $1 AND country_code IS NOT DISTINCT FROM $2 AND city IS NULL
     )`,
    [name, code, continent],
  );
}

async function main(): Promise<void> {
  const pool = getPool();

  await ensureLocation(pool, "Africa", null, "Africa");
  for (const defaults of Object.values(AFRICA_SOURCE_GEO_DEFAULTS)) {
    if (defaults.countryName) {
      const code = countryCodeFor(defaults.countryName);
      await ensureLocation(pool, defaults.countryName, code, defaults.continentName);
    }
  }

  const metaRows = await pool.query<{ resource_id: string; country: string }>(
    `SELECT DISTINCT ON (r.id) r.id::text AS resource_id,
            trim(si.raw_metadata_json->>'country') AS country
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active AND s.category = 'africa-innovation' AND s.enabled
       AND si.raw_metadata_json->>'country' IS NOT NULL
       AND trim(si.raw_metadata_json->>'country') <> ''
     ORDER BY r.id, si.last_seen_at DESC`,
  );

  let metaUpdated = 0;
  let metaLocated = 0;
  for (const row of metaRows.rows) {
    const code = countryCodeFor(row.country);
    if (!code) continue;
    await ensureLocation(pool, row.country, code, "Africa");
    const upd = await pool.query(
      `UPDATE resources
       SET primary_country_name = COALESCE(primary_country_name, $2),
           primary_country_code = COALESCE(primary_country_code, $3),
           updated_at = now()
       WHERE id = $1::uuid`,
      [row.resource_id, row.country, code],
    );
    metaUpdated += upd.rowCount ?? 0;
    const loc = await pool.query<{ id: string }>(
      `SELECT id::text FROM locations WHERE country_name = $1 AND city IS NULL LIMIT 1`,
      [row.country],
    );
    if (loc.rows[0]) {
      const ins = await pool.query(
        `INSERT INTO resource_locations (resource_id, location_id, relationship)
         VALUES ($1::uuid, $2::uuid, 'MENTIONED_IN')
         ON CONFLICT (resource_id, location_id, relationship) DO NOTHING`,
        [row.resource_id, loc.rows[0].id],
      );
      metaLocated += ins.rowCount ?? 0;
    }
  }

  const slugCase = Object.entries(AFRICA_SOURCE_GEO_DEFAULTS)
    .filter(([, geo]) => geo.countryName)
    .map(([slug, geo]) => `WHEN '${slug}' THEN '${geo.countryName!.replace(/'/g, "''")}'`)
    .join("\n            ");

  const primaryUpdated = await pool.query(
    `WITH pick AS (
       SELECT DISTINCT ON (r.id) r.id AS resource_id, s.slug
       FROM resources r
       JOIN resource_source_links l ON l.resource_id = r.id
       JOIN source_items si ON si.id = l.source_item_id
       JOIN sources s ON s.id = si.source_id
       WHERE r.active AND s.enabled AND s.category = 'africa-innovation'
         AND (r.primary_country_code IS NULL OR r.primary_country_code = '')
       ORDER BY r.id, si.last_seen_at DESC
     ),
     named AS (
       SELECT resource_id,
              CASE slug
                ${slugCase}
                ELSE NULL
              END AS country_name
       FROM pick
     )
     UPDATE resources r
     SET primary_country_name = named.country_name,
         updated_at = now()
     FROM named
     WHERE r.id = named.resource_id AND named.country_name IS NOT NULL`,
  );

  const located = await pool.query(
    `WITH pick AS (
       SELECT DISTINCT ON (r.id) r.id AS resource_id, s.slug
       FROM resources r
       JOIN resource_source_links l ON l.resource_id = r.id
       JOIN source_items si ON si.id = l.source_item_id
       JOIN sources s ON s.id = si.source_id
       WHERE r.active AND s.enabled AND s.category = 'africa-innovation'
         AND NOT EXISTS (SELECT 1 FROM resource_locations rl WHERE rl.resource_id = r.id)
       ORDER BY r.id, si.last_seen_at DESC
     ),
     target AS (
       SELECT p.resource_id,
              COALESCE(
                CASE p.slug
                  ${slugCase}
                  ELSE NULL
                END,
                'Africa'
              ) AS location_name
       FROM pick p
     )
     INSERT INTO resource_locations (resource_id, location_id, relationship)
     SELECT t.resource_id, loc.id, 'MENTIONED_IN'
     FROM target t
     JOIN locations loc ON loc.country_name = t.location_name AND loc.city IS NULL
     ON CONFLICT (resource_id, location_id, relationship) DO NOTHING`,
  );

  const codesUpdated = await pool.query(
    `UPDATE resources r
     SET primary_country_code = sub.code,
         updated_at = now()
     FROM (
       SELECT id,
              CASE lower(trim(primary_country_name))
                WHEN 'morocco' THEN 'MA'
                WHEN 'ghana' THEN 'GH'
                WHEN 'nigeria' THEN 'NG'
                WHEN 'kenya' THEN 'KE'
                WHEN 'south africa' THEN 'ZA'
                WHEN 'rwanda' THEN 'RW'
                ELSE NULL
              END AS code
       FROM resources
       WHERE primary_country_name IS NOT NULL
         AND (primary_country_code IS NULL OR primary_country_code = '')
     ) sub
     WHERE r.id = sub.id AND sub.code IS NOT NULL`,
  );

  log("info", "backfill_africa_geography_complete", {
    metadata_rows: metaRows.rowCount,
    metadata_resources_updated: metaUpdated,
    metadata_location_links: metaLocated,
    hub_primary_names: primaryUpdated.rowCount,
    catalogue_location_links: located.rowCount,
    primary_codes_set: codesUpdated.rowCount,
  });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "backfill_africa_geography_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
