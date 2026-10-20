import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDetailDrainOutcome,
  currentNeedsReviewDetailDrainMode,
  detailRefetchImprovedRow,
  formatNeedsReviewDetailDrainSummary,
  proposeDetailDrainFields,
} from "../../packages/database/src/needs-review-detail-drain.ts";
import type { NeedsReviewBulkFixRow } from "../../packages/database/src/needs-review-bulk-fix.ts";

function row(overrides: Partial<NeedsReviewBulkFixRow> = {}): NeedsReviewBulkFixRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Short",
    source_summary: "Thin.",
    extracted_index_text: "Thin.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    source_item_title: null,
    source_external_id: "1",
    canonical_url: "https://solve.mit.edu/solutions/1",
    ...overrides,
  };
}

test("defaults to dry_run mode", () => {
  const prev = process.env.NEEDS_REVIEW_DETAIL_DRAIN_APPLY;
  delete process.env.NEEDS_REVIEW_DETAIL_DRAIN_APPLY;
  assert.equal(currentNeedsReviewDetailDrainMode(), "dry_run");
  process.env.NEEDS_REVIEW_DETAIL_DRAIN_APPLY = prev;
});

test("detects material improvement from detail refetch", () => {
  const base = row({ title: "A truncated tit…", source_summary: "x", extracted_index_text: "x" });
  const fixed = proposeDetailDrainFields(base, {
    title: "A truncated title that is now complete",
    sourceSummary: "First sentence about the solution. Second sentence with more context.",
    extractedText: "First sentence about the solution. Second sentence with more context.",
  });
  assert.equal(detailRefetchImprovedRow(base, fixed), true);
});

test("classifies cleared when quality passes after repair", () => {
  const base = row({
    title: "Atlas Of The Future",
    source_slug: "atlas-of-the-future",
    canonical_url: "https://atlasofthefuture.org/project/solar-brick",
  });
  const fixed = proposeDetailDrainFields(base, {
    title: "Solar Brick",
    sourceSummary:
      "Solar Brick is a modular building block that generates electricity. It targets affordable housing in emerging markets.",
    extractedText:
      "Solar Brick is a modular building block that generates electricity. It targets affordable housing in emerging markets.",
  });
  const outcome = classifyDetailDrainOutcome(base, fixed);
  assert.equal(outcome.action, "cleared");
});

test("formats dry-run summary with by_source and samples", () => {
  const text = formatNeedsReviewDetailDrainSummary({
    mode: "dry_run",
    totals: { repaired: 2, cleared: 1, source_limited: 3, still_flagged: 4, scanned: 10, fetch_failed: 0 },
    by_source: {
      "mit-solve": { repaired: 2, cleared: 1, source_limited: 0, still_flagged: 1 },
    },
    samples: [
      {
        resource_id: "id",
        source_slug: "mit-solve",
        canonical_url: "https://example.com",
        action: "cleared",
        title_before: "Old",
        title_after: "New",
      },
    ],
  });
  assert.match(text, /NEEDS_REVIEW detail drain/);
  assert.match(text, /mit-solve/);
  assert.match(text, /Old/);
  assert.match(text, /New/);
});
