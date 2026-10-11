import assert from "node:assert/strict";
import test from "node:test";
import { repairBulkFixTitle } from "../../packages/database/src/needs-review-bulk-fix-title-repair.ts";
import type { NeedsReviewBulkFixRow } from "../../packages/database/src/needs-review-bulk-fix.ts";

function baseRow(partial: Partial<NeedsReviewBulkFixRow>): NeedsReviewBulkFixRow {
  return {
    id: "1",
    title: "",
    source_summary: "",
    extracted_index_text: "",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    source_item_title: null,
    source_external_id: null,
    canonical_url: null,
    ...partial,
  };
}

test("(a) non-truncated title + longer summary sentence => title unchanged", () => {
  const row = baseRow({
    title: "Solar Water Pump",
    source_summary: "Provides affordable irrigation to smallholder farmers.",
    extracted_index_text: "Provides affordable irrigation to smallholder farmers. More detail here for length.",
  });
  assert.equal(repairBulkFixTitle(row, row.title), "Solar Water Pump");
});

test("(b) truncated Wat + summary starting Water filtration pods => repaired", () => {
  const row = baseRow({
    title: "Wat",
    source_summary: "Water filtration pods for rural schools. The team deploys low-cost units across Kenya.",
    extracted_index_text: "Water filtration pods for rural schools. The team deploys low-cost units across Kenya.",
  });
  const repaired = repairBulkFixTitle(row, row.title);
  assert.match(repaired, /Water filtration pods/);
});

test("(c) mit-solve non-truncated title unchanged without prefix extension", () => {
  const row = baseRow({
    title: "Solar Water Solutions",
    source_summary: "Solar Water Solutions provides affordable desalination for coastal communities worldwide.",
    extracted_index_text:
      "Solar Water Solutions provides affordable desalination for coastal communities worldwide. Additional detail.",
    source_item_title: "Solar Water Solutions",
    raw_metadata: { og_title: "Solar Water Solutions | MIT Solve" },
  });
  assert.equal(repairBulkFixTitle(row, row.title), "Solar Water Solutions");
});

test("repairBulkFixTitle prefers source_item_title when it extends truncated title", () => {
  const row = baseRow({
    title: "Solar",
    source_summary: "Solar Water Solutions provides affordable desalination.",
    extracted_index_text: "Solar Water Solutions provides affordable desalination.",
    source_item_title: "Solar Water Solutions",
    raw_metadata: { og_title: "Solar Water Solutions | MIT Solve" },
  });
  assert.equal(repairBulkFixTitle(row, row.title), "Solar Water Solutions");
});
