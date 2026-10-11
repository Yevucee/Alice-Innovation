/**
 * Dry-run or apply NEEDS_REVIEW bulk fixes (Samuel: dry-run first).
 * Usage:
 *   scripts/run-with-production-env.sh npx tsx scripts/needs-review-bulk-fix.ts --dry-run
 *   scripts/run-with-production-env.sh npx tsx scripts/needs-review-bulk-fix.ts --apply
 */
import { closePool, getPool, runNeedsReviewBulkFixBatch } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");
  const sourceIdx = process.argv.indexOf("--source");
  const sourceSlug = sourceIdx >= 0 ? process.argv[sourceIdx + 1] : null;
  const pool = getPool();
  let offset = 0;
  const totals = {
    scanned: 0,
    cleared: 0,
    source_limited: 0,
    updated: 0,
    unchanged: 0,
    still_flagged: 0,
  };
  const by_source: Record<string, Record<string, number>> = {};

  for (;;) {
    const batch = await runNeedsReviewBulkFixBatch(pool, offset, {
      dryRun: dryRun || !apply,
      sourceSlug,
    });
    totals.scanned += batch.scanned;
    totals.cleared += batch.cleared;
    totals.source_limited += batch.source_limited;
    totals.updated += batch.updated;
    totals.unchanged += batch.unchanged;
    totals.still_flagged += batch.still_flagged;
    for (const [slug, counts] of Object.entries(batch.by_source)) {
      by_source[slug] = by_source[slug] ?? { cleared: 0, source_limited: 0, updated: 0, still_flagged: 0 };
      for (const [k, v] of Object.entries(counts)) {
        by_source[slug][k] = (by_source[slug][k] ?? 0) + v;
      }
    }
    if (batch.complete) break;
    offset = batch.next_offset;
  }

  log("info", dryRun ? "needs_review_bulk_fix_dry_run" : "needs_review_bulk_fix_applied", {
    totals,
    by_source,
    mode: dryRun ? "dry_run" : "apply",
    source_filter: sourceSlug,
  });

  await closePool();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
