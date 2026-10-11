import assert from "node:assert/strict";
import test from "node:test";
import { mergeIngestDraftPreservingQuality } from "../../packages/database/src/ingest-preserve-quality.ts";
import type { NormalisedDraft } from "@alice/shared";

const existing = {
  canonical_title: "AfriLabs Hub Member — Clean Energy Cooperative",
  source_summary:
    "A member hub listing with enough text to pass ingest quality gates when stored from a full detail page fetch.",
  extracted_index_text:
    "A member hub listing with enough text to pass ingest quality gates when stored from a full detail page fetch. Additional paragraph about programmes.",
  review_status: "AUTO_INGESTED",
  review_reason_codes: [] as string[],
};

test("mergeIngestDraftPreservingQuality keeps AUTO_INGESTED when re-fetch is thinner", () => {
  const incoming: NormalisedDraft = {
    title: "Clean",
    sourceSummary: "Short og tag.",
    extractedText: "Short og tag.",
    canonicalUrl: "https://www.afrilabs.com/hub/example/",
    originalUrl: "https://www.afrilabs.com/hub/example/",
    externalId: "example",
    resourceType: "INNOVATION",
    evidenceBasis: "PRIMARY",
    evidenceStage: "UNKNOWN",
    language: "en",
    tags: [],
    rawMetadata: {},
  };
  const result = mergeIngestDraftPreservingQuality(existing, incoming);
  assert.equal(result.treatAsUnchanged, true);
  assert.equal(result.draft.title, existing.canonical_title);
});
