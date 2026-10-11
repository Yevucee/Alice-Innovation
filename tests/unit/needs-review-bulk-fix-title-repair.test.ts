import assert from "node:assert/strict";
import test from "node:test";
import { repairBulkFixTitle } from "../../packages/database/src/needs-review-bulk-fix-title-repair.ts";
import type { NeedsReviewBulkFixRow } from "../../packages/database/src/needs-review-bulk-fix.ts";

test("repairBulkFixTitle prefers source_item_title and strips MIT Solve og suffix", () => {
  const row: NeedsReviewBulkFixRow = {
    id: "1",
    title: "Solar",
    source_summary: "Solar Water Solutions provides affordable desalination for coastal communities worldwide.",
    extracted_index_text:
      "Solar Water Solutions provides affordable desalination for coastal communities worldwide. Additional detail paragraph.",
    organisation_name: null,
    person_name: null,
    raw_metadata: { og_title: "Solar Water Solutions | MIT Solve" },
    source_slug: "mit-solve",
    source_item_title: "Solar Water Solutions",
    canonical_url: "https://solve.mit.edu/solutions/1",
  };
  const repaired = repairBulkFixTitle(row, row.title);
  assert.equal(repaired, "Solar Water Solutions");
});

test("repairBulkFixTitle uses summary lead when title is truncated", () => {
  const row: NeedsReviewBulkFixRow = {
    id: "2",
    title: "Wat",
    source_summary: "Water filtration pods for rural schools. The team deploys low-cost units across Kenya.",
    extracted_index_text: "Water filtration pods for rural schools. The team deploys low-cost units across Kenya.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    source_item_title: null,
    canonical_url: null,
  };
  const repaired = repairBulkFixTitle(row, row.title);
  assert.match(repaired, /Water filtration pods/);
});
