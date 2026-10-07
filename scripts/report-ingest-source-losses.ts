/**
 * Print latest ingestion run per source with pipeline_stats breakdown (Asia by default).
 * Usage: npx tsx scripts/report-ingest-source-losses.ts [--category=asia-innovation]
 */
import { getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

loadDotEnv();

const category = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1] ?? "asia-innovation";

async function main(): Promise<void> {
  const pool = getPool();
  const rows = await pool.query<{
    slug: string;
    discovered: number;
    items_new: number;
    items_updated: number;
    items_unchanged: number;
    items_failed: number;
    pipeline_stats: Record<string, unknown>;
    error_summary: string | null;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (ir.source_id)
         ir.source_id,
         ir.items_discovered,
         ir.items_new,
         ir.items_updated,
         ir.items_unchanged,
         ir.items_failed,
         ir.pipeline_stats,
         ir.error_summary
       FROM ingestion_runs ir
       ORDER BY ir.source_id, ir.started_at DESC
     )
     SELECT s.slug,
            l.items_discovered AS discovered,
            l.items_new,
            l.items_updated,
            l.items_unchanged,
            l.items_failed,
            COALESCE(l.pipeline_stats, '{}'::jsonb) AS pipeline_stats,
            l.error_summary
     FROM sources s
     JOIN latest l ON l.source_id = s.id
     WHERE s.category = $1 AND s.enabled = true
     ORDER BY l.items_discovered DESC NULLS LAST`,
    [category],
  );

  console.log(`# Ingest loss report (${category})\n`);
  console.log("| source | discovered | new | updated | unchanged | failed | limit_drop | cross_src | detail_skip | notes |");
  console.log("|--------|------------|-----|---------|-----------|--------|------------|-----------|-------------|-------|");
  for (const row of rows.rows) {
    const ps = row.pipeline_stats ?? {};
    const limitDrop = Number(ps.dropped_limit ?? 0);
    const cross = Number(ps.cross_source_reuse ?? 0);
    const detailSkip = Number(ps.detail_skipped ?? 0) + Number(ps.detail_skipped_bootstrap ?? 0);
    const notes: string[] = [];
    if (ps.skipped_duplicate_of) notes.push("duplicate_of_skip");
    if (row.error_summary?.includes("skipped_duplicate_of")) notes.push(row.error_summary.split(";")[0]);
    if (limitDrop > 0) notes.push("first_run_cap");
    if (cross > 0) notes.push("same_url_other_source");
    const gap = row.discovered - row.items_new;
    if (gap > row.items_updated + row.items_unchanged + row.items_failed + limitDrop + detailSkip && gap > 5) {
      notes.push("see_failures_or_parse");
    }
    console.log(
      `| ${row.slug} | ${row.discovered} | ${row.items_new} | ${row.items_updated} | ${row.items_unchanged} | ${row.items_failed} | ${limitDrop} | ${cross} | ${detailSkip} | ${notes.join(", ") || "—"} |`,
    );
  }
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
