import { closePool, getPool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

loadDotEnv();

const AFRICA_CODES = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG",
  "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML",
  "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD",
  "TZ", "TG", "TN", "UG", "ZM", "ZW",
];

async function main(): Promise<void> {
  const pool = getPool();
  const total = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM resources WHERE active`,
  );
  const africaSource = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active AND s.enabled AND s.category = 'africa-innovation'`,
  );
  const primaryAfrica = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM resources r
     WHERE r.active AND upper(r.primary_country_code) = ANY($1::text[])`,
    [AFRICA_CODES],
  );
  const locAfrica = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     JOIN resource_locations rl ON rl.resource_id = r.id
     JOIN locations loc ON loc.id = rl.location_id
     WHERE r.active AND (
       upper(loc.country_code) = ANY($1::text[])
       OR loc.continent = 'Africa'
     )`,
    [AFRICA_CODES],
  );
  const continentFilter = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     JOIN resource_locations rl ON rl.resource_id = r.id
     JOIN locations loc ON loc.id = rl.location_id
     WHERE r.active AND loc.continent = 'Africa'`,
  );
  const noGeo = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM resources r
     WHERE r.active
       AND (r.primary_country_code IS NULL OR r.primary_country_code = '')
       AND NOT EXISTS (SELECT 1 FROM resource_locations rl WHERE rl.resource_id = r.id)`,
  );
  const africaSourceNoGeo = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active AND s.enabled AND s.category = 'africa-innovation'
       AND (r.primary_country_code IS NULL OR r.primary_country_code = '')
       AND NOT EXISTS (SELECT 1 FROM resource_locations rl WHERE rl.resource_id = r.id)`,
  );
  const metaCountry = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT r.id)::int AS n
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active AND s.category = 'africa-innovation'
       AND si.raw_metadata_json->>'country' IS NOT NULL
       AND trim(si.raw_metadata_json->>'country') <> ''`,
  );
  const bySource = await pool.query<{ slug: string; items: number; with_primary: number; with_loc: number }>(
    `SELECT s.slug,
            count(DISTINCT r.id)::int AS items,
            count(DISTINCT r.id) FILTER (WHERE r.primary_country_code IS NOT NULL AND r.primary_country_code <> '')::int AS with_primary,
            count(DISTINCT r.id) FILTER (WHERE EXISTS (
              SELECT 1 FROM resource_locations rl WHERE rl.resource_id = r.id
            ))::int AS with_loc
     FROM sources s
     JOIN source_items si ON si.source_id = s.id AND si.active
     JOIN resource_source_links l ON l.source_item_id = si.id
     JOIN resources r ON r.id = l.resource_id AND r.active
     WHERE s.category = 'africa-innovation' AND s.enabled
     GROUP BY s.slug
     ORDER BY items DESC`,
  );

  console.log(JSON.stringify({
    active_resources: total.rows[0]?.n,
    distinct_africa_innovation_resources: africaSource.rows[0]?.n,
    with_primary_african_country_code: primaryAfrica.rows[0]?.n,
    with_location_africa_country_or_continent: locAfrica.rows[0]?.n,
    continent_africa_location_only: continentFilter.rows[0]?.n,
    no_country_and_no_locations: noGeo.rows[0]?.n,
    africa_source_resources_missing_geo: africaSourceNoGeo.rows[0]?.n,
    africa_source_with_metadata_country: metaCountry.rows[0]?.n,
    africa_sources_breakdown: bySource.rows,
  }, null, 2));
  await closePool();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
