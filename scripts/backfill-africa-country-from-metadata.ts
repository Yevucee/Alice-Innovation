import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { countryCodeFor } from "@alice/taxonomy";

loadDotEnv();

async function main(): Promise<void> {
  const pool = getPool();
  const rows = await pool.query<{ resource_id: string; country: string }>(
    `SELECT DISTINCT ON (r.id) r.id::text AS resource_id,
            trim(si.raw_metadata_json->>'country') AS country
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND s.category = 'africa-innovation'
       AND s.enabled
       AND si.raw_metadata_json->>'country' IS NOT NULL
       AND trim(si.raw_metadata_json->>'country') <> ''
       AND (r.primary_country_code IS NULL OR r.primary_country_name IS NULL)
     ORDER BY r.id, si.last_seen_at DESC`,
  );

  let updated = 0;
  for (const row of rows.rows) {
    const code = countryCodeFor(row.country);
    if (!code) continue;
    const result = await pool.query(
      `UPDATE resources
       SET primary_country_name = $2,
           primary_country_code = $3,
           updated_at = now()
       WHERE id = $1::uuid
         AND (primary_country_code IS NULL OR primary_country_code = '')`,
      [row.resource_id, row.country, code],
    );
    updated += result.rowCount ?? 0;
  }

  log("info", "backfill_africa_country_from_metadata", { candidates: rows.rowCount, updated });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "backfill_africa_country_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
