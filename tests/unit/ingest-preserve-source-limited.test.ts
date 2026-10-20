import assert from "node:assert/strict";
import test from "node:test";
import { mergeIngestDraftPreservingQuality } from "../../packages/database/src/ingest-preserve-quality.ts";

test("mergeIngestDraftPreservingQuality keeps SOURCE_LIMITED when re-ingest is thinner", () => {
  const existing = {
    canonical_title: "Stable Title",
    source_summary: "Enough summary text for the library to index this resource properly.",
    extracted_index_text: "Enough summary text for the library to index this resource properly.",
    review_status: "SOURCE_LIMITED",
    review_reason_codes: ["source_limited_accepted", "short_description"],
  };
  const incoming = {
    title: "Atlas Of The Future",
    sourceSummary: "Thin listing",
    extractedText: "Thin listing",
    canonicalUrl: "",
    originalUrl: "",
    externalId: "",
    resourceType: "SOLUTION" as const,
    evidenceBasis: "UNKNOWN" as const,
    evidenceStage: "UNKNOWN" as const,
    language: "en",
    imageUrl: null,
    publishedAt: null,
    organisationName: null,
    personName: null,
    countryName: null,
    countryCode: null,
    continentName: null,
    tags: [],
    maturityStage: "UNKNOWN" as const,
    costLevel: "UNKNOWN" as const,
    commercialStatus: "UNKNOWN" as const,
    rawMetadata: {},
    etag: null,
    lastModified: null,
  };
  const result = mergeIngestDraftPreservingQuality(existing, incoming);
  assert.equal(result.treatAsUnchanged, true);
  assert.equal(result.draft.title, "Stable Title");
});
