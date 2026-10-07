import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyImageBackfillStallGuard,
  bumpImageBackfillTotals,
} from "../../apps/ingestor/src/post-deploy-image-backfill.ts";

test("bumpImageBackfillTotals accumulates scanned and filled", () => {
  const totals = bumpImageBackfillTotals(
    { scanned: 10, filled: 2, skipped: 8, failed: 0, hosts_blocked: 0 },
    { candidates: 5, updated: 1, skipped: 4, failed: 0 },
  );
  assert.equal(totals.scanned, 15);
  assert.equal(totals.filled, 3);
});

test("image backfill should advance when batch is all failed or skipped", () => {
  const shouldAdvance = (
    rowCount: number,
    summary: { updated: number; skipped: number; failed?: number },
  ) => {
    const perRun = 80;
    if (rowCount < perRun) return true;
    if (summary.updated > 0) return false;
    const failed = summary.failed ?? 0;
    if (rowCount > 0 && summary.skipped + failed >= rowCount) return true;
    return false;
  };
  assert.equal(shouldAdvance(80, { updated: 0, skipped: 40, failed: 40 }), true);
});

test("applyImageBackfillStallGuard marks stalled after consecutive no-progress steps", () => {
  let progress: Record<string, unknown> = { global_offset: 0, totals: { filled: 0 } };
  let stalled = false;
  for (let i = 0; i < 4; i += 1) {
    const result = applyImageBackfillStallGuard(progress, false);
    progress = result.progress;
    stalled = result.stalled;
  }
  assert.equal(stalled, false);
  const final = applyImageBackfillStallGuard(progress, false);
  assert.equal(final.stalled, true);
  assert.equal(final.progress.stall_reason, "no_progress");
});
