#!/usr/bin/env npx tsx
/**
 * Logs NEEDS_REVIEW breakdown and sample rows for key sources (JSON to stdout).
 * Usage: DATABASE_URL=... npx tsx scripts/needs-review-source-report.ts
 */
import { closePool, getPool } from "@alice/database";
import {
  countNeedsReview,
  qualityReviewBreakdown,
  sampleNeedsReviewBySources,
} from "@alice/database";

async function main(): Promise<void> {
  const pool = getPool();
  const before = await countNeedsReview(pool);
  const breakdown = await qualityReviewBreakdown(pool);
  const samples = await sampleNeedsReviewBySources(pool, [
    "mit-solve",
    "atlas-of-the-future",
    "solar-impulse",
  ], 10);
  console.log(JSON.stringify({
    needs_review_total: before,
    by_reason: breakdown.by_reason,
    by_source_top: breakdown.by_source,
    samples,
  }, null, 2));
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
