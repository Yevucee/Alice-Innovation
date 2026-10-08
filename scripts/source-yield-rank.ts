/**
 * Rank enabled sources by latest ingest yield + NEEDS_REVIEW %.
 * Usage: npx tsx scripts/source-yield-rank.ts
 */
import { getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const pool = getPool();
  const rows = await pool.query<{
    slug: string;
    category: string;
    item_count: number;
    discovered: number | null;
    items_new: number | null;
    items_updated: number | null;
    items_failed: number | null;
    needs_review_pct: string | null;
    run_at: Date | null;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (ir.source_id)
         ir.source_id,
         ir.items_discovered,
         ir.items_new,
         ir.items_updated,
         ir.items_failed,
         ir.started_at
       FROM ingestion_runs ir
       ORDER BY ir.source_id, ir.started_at DESC
     ),
     review AS (
       SELECT si.source_id,
              round(100.0 * count(*) FILTER (WHERE r.review_status = 'NEEDS_REVIEW')
                / nullif(count(*), 0), 1) AS needs_review_pct
       FROM source_items si
       JOIN resource_source_links l ON l.source_item_id = si.id
       JOIN resources r ON r.id = l.resource_id
       GROUP BY si.source_id
     )
     SELECT s.slug, s.category, s.item_count,
            l.items_discovered AS discovered,
            l.items_new,
            l.items_updated,
            l.items_failed,
            rv.needs_review_pct,
            l.started_at AS run_at
     FROM sources s
     LEFT JOIN latest l ON l.source_id = s.id
     LEFT JOIN review rv ON rv.source_id = s.id
     WHERE s.enabled = true
     ORDER BY coalesce(l.items_new, 0) DESC, s.item_count DESC`,
  );

  console.log("| slug | category | item_count | discovered | new | updated | failed | needs_review_% | last_run |");
  console.log("|------|----------|------------|------------|-----|---------|--------|----------------|----------|");
  for (const row of rows.rows) {
    console.log(
      `| ${row.slug} | ${row.category} | ${row.item_count} | ${row.discovered ?? "—"} | ${row.items_new ?? "—"} | ${row.items_updated ?? "—"} | ${row.items_failed ?? "—"} | ${row.needs_review_pct ?? "—"} | ${row.run_at ? row.run_at.toISOString().slice(0, 10) : "—"} |`,
    );
  }
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
