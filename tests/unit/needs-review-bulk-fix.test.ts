import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBulkFixOutcome,
  proposeNeedsReviewBulkFix,
} from "../../packages/database/src/needs-review-bulk-fix.ts";

test("proposeNeedsReviewBulkFix repairs ALL CAPS title", () => {
  const fixed = proposeNeedsReviewBulkFix({
    id: "1",
    title: "ACME SOLAR PANELS",
    source_summary: "A long enough description for the quality gate to pass without short_description flag on this row.",
    extracted_index_text: "A long enough description for the quality gate to pass without short_description flag on this row.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    source_item_title: null,
    canonical_url: null,
  });
  assert.match(fixed.title, /Acme/);
});

test("classifyBulkFixOutcome clears when fixes resolve reasons", () => {
  const row = {
    id: "1",
    title: "ACME SOLAR",
    source_summary: "Enough body text here to satisfy the minimum length requirement for catalogue ingest quality checks.",
    extracted_index_text: "Enough body text here to satisfy the minimum length requirement for catalogue ingest quality checks.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    source_item_title: null,
    canonical_url: null,
  };
  const fixed = proposeNeedsReviewBulkFix(row);
  const outcome = classifyBulkFixOutcome(row, fixed);
  assert.equal(outcome.action, "cleared");
});
