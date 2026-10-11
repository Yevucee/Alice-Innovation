/**
 * Dry-run or apply NEEDS_REVIEW bulk fixes (Samuel: dry-run first).
 * Usage:
 *   scripts/run-with-production-env.sh npx tsx scripts/needs-review-bulk-fix.ts --dry-run
 *   scripts/run-with-production-env.sh npx tsx scripts/needs-review-bulk-fix.ts --apply
 */
import {
  closePool,
  formatNeedsReviewBulkFixSummary,
  getPool,
  needsReviewBulkFixApplyEnabled,
  NEEDS_REVIEW_BULK_FIX_SAMPLE_LIMIT,
  runNeedsReviewBulkFixBatch,
} from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply") && needsReviewBulkFixApplyEnabled();
  const dryRun = !apply;
  if (process.argv.includes("--apply") && !needsReviewBulkFixApplyEnabled()) {
    log("warn", "needs_review_bulk_fix_apply_blocked", {
      message: "Set NEEDS_REVIEW_BULK_FIX_APPLY=true on alice-ingestor before --apply",
    });
  }
  const sourceIdx = process.argv.indexOf("--source");
  const sourceSlug = sourceIdx >= 0 ? process.argv[sourceIdx + 1] : null;
  const pool = getPool();
  let lastId: string | null = null;
  const totals = {
    scanned: 0,
    cleared: 0,
    source_limited: 0,
    updated: 0,
    unchanged: 0,
    still_flagged: 0,
  };
  const by_source: Record<string, Record<string, number>> = {};
  const samples: import("@alice/database").NeedsReviewBulkFixSample[] = [];

  for (;;) {
    const batch = await runNeedsReviewBulkFixBatch(pool, lastId, {
      dryRun,
      sourceSlug,
      maxSamples: NEEDS_REVIEW_BULK_FIX_SAMPLE_LIMIT,
      existingSampleCount: samples.length,
    });
    samples.push(...batch.samples);
    lastId = batch.next_last_id;
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
  }

  const dry_run_summary = formatNeedsReviewBulkFixSummary({
    mode: dryRun ? "dry_run" : "apply",
    totals,
    by_source,
    samples: samples.slice(0, NEEDS_REVIEW_BULK_FIX_SAMPLE_LIMIT),
  });
  log("info", dryRun ? "needs_review_bulk_fix_dry_run" : "needs_review_bulk_fix_applied", {
    totals,
    by_source,
    title_samples: samples.slice(0, NEEDS_REVIEW_BULK_FIX_SAMPLE_LIMIT),
    dry_run_summary,
    mode: dryRun ? "dry_run" : "apply",
    source_filter: sourceSlug,
  });
  console.log(dry_run_summary);

  await closePool();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
