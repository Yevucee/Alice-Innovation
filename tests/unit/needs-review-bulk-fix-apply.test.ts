import assert from "node:assert/strict";
import test from "node:test";
import {
  formatNeedsReviewBulkFixSummary,
  needsReviewBulkFixApplyEnabled,
} from "../../packages/database/src/needs-review-bulk-fix.ts";

test("needsReviewBulkFixApplyEnabled requires NEEDS_REVIEW_BULK_FIX_APPLY=true", () => {
  const prev = process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  delete process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  assert.equal(needsReviewBulkFixApplyEnabled(), false);
  process.env.NEEDS_REVIEW_BULK_FIX_APPLY = "true";
  assert.equal(needsReviewBulkFixApplyEnabled(), true);
  process.env.NEEDS_REVIEW_BULK_FIX_APPLY = "1";
  assert.equal(needsReviewBulkFixApplyEnabled(), true);
  if (prev === undefined) delete process.env.NEEDS_REVIEW_BULK_FIX_APPLY;
  else process.env.NEEDS_REVIEW_BULK_FIX_APPLY = prev;
});

test("formatNeedsReviewBulkFixSummary includes totals and title samples", () => {
  const text = formatNeedsReviewBulkFixSummary({
    mode: "dry_run",
    totals: { cleared: 10, source_limited: 2, updated: 3, still_flagged: 1, scanned: 100 },
    by_source: { "mit-solve": { cleared: 10, source_limited: 0, updated: 0, still_flagged: 0 } },
    samples: [
      {
        resource_id: "a",
        source_slug: "mit-solve",
        action: "cleared",
        title_before: "OLD TITLE",
        title_after: "Old Title",
      },
    ],
  });
  assert.match(text, /run_mode=dry_run/);
  assert.match(text, /cleared=10/);
  assert.match(text, /OLD TITLE/);
});
