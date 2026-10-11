/**
 * One-off repair for AfriLabs false NEEDS_REVIEW flags after accidental scope=all run.
 * Dry-run by default; pass --apply after Samuel reviews counts.
 */
import { closePool, countNeedsReview, getPool, runNeedsReviewBulkFixBatch } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const pool = getPool();
  const before = await countNeedsReview(pool);
  const afrilabsBefore = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM resources r
     JOIN resource_source_links l ON l.resource_id = r.id
     JOIN source_items si ON si.id = l.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW' AND s.slug = 'afrilabs'`,
  );
  let offset = 0;
  const totals = { cleared: 0, source_limited: 0, updated: 0, still_flagged: 0, scanned: 0 };
  for (;;) {
    const batch = await runNeedsReviewBulkFixBatch(pool, offset, {
      dryRun: !apply,
      sourceSlug: "afrilabs",
    });
    totals.scanned += batch.scanned;
    totals.cleared += batch.cleared;
    totals.source_limited += batch.source_limited;
    totals.updated += batch.updated;
    totals.still_flagged += batch.still_flagged;
    if (batch.complete) break;
    offset = batch.next_offset;
  }
  const after = apply ? await countNeedsReview(pool) : null;
  log("info", apply ? "afrilabs_needs_review_repair_applied" : "afrilabs_needs_review_repair_dry_run", {
    needs_review_total_before: before,
    afrilabs_needs_review_before: Number(afrilabsBefore.rows[0]?.count ?? 0),
    needs_review_total_after: after,
    totals,
    mode: apply ? "apply" : "dry_run",
  });
  await closePool();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
