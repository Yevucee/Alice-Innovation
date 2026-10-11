import assert from "node:assert/strict";
import test from "node:test";
import {
  detectBulkFixJunk,
  JUNK_DUPLICATE_TITLE_CONTENT,
  JUNK_GENERIC_TITLE,
} from "../../packages/database/src/needs-review-bulk-fix-junk.ts";
import type { NeedsReviewBulkFixRow } from "../../packages/database/src/needs-review-bulk-fix.ts";

function row(partial: Partial<NeedsReviewBulkFixRow> & Pick<NeedsReviewBulkFixRow, "id" | "title" | "source_slug">): NeedsReviewBulkFixRow {
  return {
    source_summary: partial.source_summary ?? "Summary text that is not used for junk checks in most cases here.",
    extracted_index_text: partial.extracted_index_text ?? "Body text placeholder.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_item_title: null,
    canonical_url: null,
    ...partial,
  };
}

test("detectBulkFixJunk flags navigation and site-name titles from prod samples", () => {
  assert.equal(
    detectBulkFixJunk(row({ id: "1", title: "Advance Search", source_slug: "nia-innovation-catalogue" }), "Advance Search"),
    JUNK_GENERIC_TITLE,
  );
  assert.equal(
    detectBulkFixJunk(row({ id: "2", title: "Atlas of the Future", source_slug: "atlas-of-the-future" }), "Atlas of the Future"),
    JUNK_GENERIC_TITLE,
  );
  assert.equal(
    detectBulkFixJunk(
      row({
        id: "3",
        title: "图解教育 - 中华人民共和国教育部政府门户网站",
        source_slug: "china-college-students-innovation-competition",
      }),
      "图解教育 - 中华人民共和国教育部政府门户网站",
    ),
    JUNK_GENERIC_TITLE,
  );
  assert.equal(
    detectBulkFixJunk(
      row({ id: "4", title: "In5 Media – Green Room", source_slug: "in5-dubai" }),
      "In5 Media – Green Room",
    ),
    JUNK_GENERIC_TITLE,
  );
});

test("detectBulkFixJunk flags mit-solve person-name stub, not ambiguous one-word products", () => {
  assert.equal(
    detectBulkFixJunk(
      row({
        id: "5",
        title: "Sabrina",
        source_slug: "mit-solve",
        person_name: "Sabrina",
        extracted_index_text: "Short.",
      }),
      "Sabrina",
    ),
    JUNK_GENERIC_TITLE,
  );
  assert.equal(
    detectBulkFixJunk(
      row({
        id: "5b",
        title: "Helio",
        source_slug: "mit-solve",
        extracted_index_text: "Short.",
      }),
      "Helio",
    ),
    null,
  );

  const tracker: Record<string, Record<string, string>> = {};
  const shared = row({
    id: "6",
    title: "Community Cooling Hub",
    source_slug: "hundred",
    source_summary: "Same listing body for duplicate detection test case.",
    extracted_index_text: "Same listing body for duplicate detection test case.",
  });
  assert.equal(detectBulkFixJunk(shared, "Community Cooling Hub", tracker), null);
  const dup = row({
    id: "7",
    title: "Community Cooling Hub",
    source_slug: "hundred",
    source_summary: "Same listing body for duplicate detection test case.",
    extracted_index_text: "Same listing body for duplicate detection test case.",
  });
  assert.equal(detectBulkFixJunk(dup, "Community Cooling Hub", tracker), JUNK_DUPLICATE_TITLE_CONTENT);
});
