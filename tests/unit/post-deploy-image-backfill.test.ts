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
