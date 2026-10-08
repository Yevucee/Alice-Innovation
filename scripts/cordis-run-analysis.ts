/**
 * CORDIS production run breakdown + grant_record counts.
 * Usage: npx tsx scripts/cordis-run-analysis.ts
 */
import { getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const pool = getPool();
  const slugs = [
    "cordis-horizon-europe-projects",
    "cordis-horizon-2020-projects",
    "cordis-eic-accelerator-projects",
  ];

  for (const slug of slugs) {
    const runs = await pool.query(
      `SELECT ir.started_at, ir.status, ir.items_discovered, ir.items_new, ir.items_updated,
              ir.items_unchanged, ir.items_failed, ir.pipeline_stats, ir.error_summary
       FROM ingestion_runs ir
       JOIN sources s ON s.id = ir.source_id
       WHERE s.slug = $1
       ORDER BY ir.started_at DESC LIMIT 3`,
      [slug],
    );
    console.log(`\n## ${slug}\n`);
    for (const row of runs.rows) {
      console.log(JSON.stringify(row, null, 2));
    }
  }

  const grantCounts = await pool.query(
    `SELECT s.slug, count(*)::int AS items,
            count(DISTINCT l.resource_id)::int AS resources
     FROM source_items si
     JOIN sources s ON s.id = si.source_id
     JOIN resource_source_links l ON l.source_item_id = si.id
     WHERE s.slug LIKE 'cordis-%'
       AND coalesce(si.raw_metadata_json->>'grant_record', '') IN ('true', '1')
     GROUP BY s.slug`,
  );
  console.log("\n## grant_record tagged (in DB)\n", grantCounts.rows);

  const hub71 = await pool.query(
    `SELECT s.slug, s.item_count, ir.items_discovered, ir.items_new, ir.items_failed, ir.error_summary
     FROM sources s
     LEFT JOIN LATERAL (
       SELECT items_discovered, items_new, items_failed, error_summary
       FROM ingestion_runs WHERE source_id = s.id ORDER BY started_at DESC LIMIT 1
     ) ir ON true
     WHERE s.slug IN ('hub71-startup-directory', 'circulate-capital', 'hkstp-company-directory')`,
  );
  console.log("\n## Asia adapters latest run\n", hub71.rows);

  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
