import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkFixModeWritesOutcome,
  currentNeedsReviewBulkFixMode,
  needsReviewBulkFixApplyEnabled,
} from "../../packages/database/src/needs-review-bulk-fix.ts";

test("NEEDS_REVIEW_BULK_FIX_APPLY modes: dry_run, cleared-only, all", () => {
  const prev = process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  delete process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  assert.equal(currentNeedsReviewBulkFixMode(), "dry_run");
  assert.equal(needsReviewBulkFixApplyEnabled(), false);

  process.env.NEEDS_REVIEW_BULK_FIX_APPLY = "cleared-only";
  assert.equal(currentNeedsReviewBulkFixMode(), "apply_cleared_only");
  assert.equal(needsReviewBulkFixApplyEnabled(), true);
  assert.equal(bulkFixModeWritesOutcome("apply_cleared_only", "cleared"), true);
  assert.equal(bulkFixModeWritesOutcome("apply_cleared_only", "source_limited"), false);
  assert.equal(bulkFixModeWritesOutcome("apply_cleared_only", "hide"), false);

  process.env.NEEDS_REVIEW_BULK_FIX_APPLY = "all";
  assert.equal(currentNeedsReviewBulkFixMode(), "apply_all");
  assert.equal(bulkFixModeWritesOutcome("apply_all", "hide"), true);
  assert.equal(bulkFixModeWritesOutcome("apply_all", "source_limited"), true);

  process.env.NEEDS_REVIEW_BULK_FIX_APPLY = "true";
  assert.equal(currentNeedsReviewBulkFixMode(), "apply_all");

  if (prev === undefined) delete process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  else process.env.NEEDS_REVIEW_BULK_FIX_APPLY = prev;
});
