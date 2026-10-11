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
    source_external_id: null,
    canonical_url: null,
    ...partial,
  };
}

test("detectBulkFixJunk flags navigation and portal titles from prod samples", () => {
  assert.deepEqual(
    detectBulkFixJunk(row({ id: "1", title: "Advance Search", source_slug: "nia-innovation-catalogue" }), "Advance Search"),
    { code: JUNK_GENERIC_TITLE, rule: "navigation_title" },
  );
  assert.deepEqual(
    detectBulkFixJunk(
      row({
        id: "3",
        title: "图解教育 - 中华人民共和国教育部政府门户网站",
        source_slug: "china-college-students-innovation-competition",
      }),
      "图解教育 - 中华人民共和国教育部政府门户网站",
    ),
    { code: JUNK_GENERIC_TITLE, rule: "government_portal_title" },
  );
  assert.deepEqual(
    detectBulkFixJunk(
      row({ id: "4", title: "In5 Media – Green Room", source_slug: "in5-dubai" }),
      "In5 Media – Green Room",
    ),
    { code: JUNK_GENERIC_TITLE, rule: "site_chrome_title" },
  );
});

test("atlas exact site title without repairable URL is site_brand unrepaired", () => {
  const hit = detectBulkFixJunk(
    row({ id: "2", title: "Atlas of the Future", source_slug: "atlas-of-the-future", canonical_url: "https://atlasofthefuture.org/" }),
    "Atlas of the Future",
  );
  assert.equal(hit?.rule, "site_brand_title_unrepaired");
});

test("atlas project subtitle title is not hidden", () => {
  assert.equal(
    detectBulkFixJunk(
      row({ id: "2b", title: "Atlas of the Future: Community Cooling", source_slug: "atlas-of-the-future" }),
      "Atlas of the Future: Community Cooling",
    ),
    null,
  );
});

test("detectBulkFixJunk flags mit-solve person stub and single letter only", () => {
  assert.deepEqual(
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
    { code: JUNK_GENERIC_TITLE, rule: "mit_solve_person_name_stub" },
  );
  assert.deepEqual(
    detectBulkFixJunk(row({ id: "5a", title: "a", source_slug: "mit-solve" }), "a"),
    { code: JUNK_GENERIC_TITLE, rule: "single_letter_title" },
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
});

test("duplicate requires identical fingerprint including URL", () => {
  const tracker: Record<string, Record<string, string>> = {};
  const shared = row({
    id: "6",
    title: "Community Cooling Hub",
    source_slug: "hundred",
    source_summary: "Same listing body for duplicate detection test case.",
    extracted_index_text: "Same listing body for duplicate detection test case.",
    canonical_url: "https://example.com/a",
    source_external_id: "a",
  });
  assert.equal(detectBulkFixJunk(shared, "Community Cooling Hub", tracker), null);
  const dup = row({
    id: "7",
    title: "Community Cooling Hub",
    source_slug: "hundred",
    source_summary: "Same listing body for duplicate detection test case.",
    extracted_index_text: "Same listing body for duplicate detection test case.",
    canonical_url: "https://example.com/a",
    source_external_id: "a",
  });
  assert.deepEqual(detectBulkFixJunk(dup, "Community Cooling Hub", tracker), {
    code: JUNK_DUPLICATE_TITLE_CONTENT,
    rule: "duplicate_title_url_body",
  });
});
