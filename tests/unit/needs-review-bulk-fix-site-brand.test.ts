import assert from "node:assert/strict";
import test from "node:test";
import {
  repairSiteBrandPlaceholderTitle,
  titleFromProjectCanonicalUrl,
} from "../../packages/database/src/needs-review-bulk-fix-site-brand.ts";
import { detectBulkFixJunk } from "../../packages/database/src/needs-review-bulk-fix-junk.ts";
import type { NeedsReviewBulkFixRow } from "../../packages/database/src/needs-review-bulk-fix.ts";

function atlasRow(url: string, title = "Atlas of the Future"): NeedsReviewBulkFixRow {
  return {
    id: "1",
    title,
    source_summary: "Short site chrome.",
    extracted_index_text: "Short site chrome.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "atlas-of-the-future",
    source_item_title: null,
    source_external_id: null,
    canonical_url: url,
  };
}

test("titleFromProjectCanonicalUrl title-cases atlas project slugs", () => {
  assert.equal(titleFromProjectCanonicalUrl("https://atlasofthefuture.org/project/ecosia"), "Ecosia");
  assert.equal(titleFromProjectCanonicalUrl("https://atlasofthefuture.org/the-turing-trust"), "The Turing Trust");
  assert.equal(titleFromProjectCanonicalUrl("https://atlasofthefuture.org/cities-health-2"), "Cities Health");
});

test("atlas site-name title is repaired from URL, not hidden", () => {
  const row = atlasRow("https://atlasofthefuture.org/project/ecosia");
  const repaired = repairSiteBrandPlaceholderTitle(row, row.title);
  assert.equal(repaired, "Ecosia");
  assert.equal(detectBulkFixJunk(row, repaired), null);
});

test("mit-solve real multi-word project titles are not junk", () => {
  const row: NeedsReviewBulkFixRow = {
    id: "m1",
    title: "Digizen Digital ID",
    source_summary: "Thin listing text for a solve solution page.",
    extracted_index_text: "Thin listing text for a solve solution page.",
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    source_item_title: "Digizen Digital ID",
    source_external_id: "113524",
    canonical_url: "https://solve.mit.edu/solutions/113524",
  };
  assert.equal(detectBulkFixJunk(row, row.title), null);
});

test("duplicate hide requires same URL not just same title", () => {
  const tracker: Record<string, Record<string, string>> = {};
  const body = "Shared thin body text for duplicate fingerprint testing in unit tests here.";
  const a: NeedsReviewBulkFixRow = {
    id: "w1",
    title: "Insecticidal Proteins AND Methods FOR Their USE",
    source_summary: body,
    extracted_index_text: body,
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: "wipo-green",
    source_item_title: null,
    source_external_id: "p1",
    canonical_url: "https://patents.wipo.green/p1",
  };
  const b = { ...a, id: "w2", source_external_id: "p2", canonical_url: "https://patents.wipo.green/p2" };
  assert.equal(detectBulkFixJunk(a, a.title, tracker), null);
  assert.equal(detectBulkFixJunk(b, b.title, tracker), null);
});
