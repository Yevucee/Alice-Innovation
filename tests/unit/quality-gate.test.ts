import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateDraftQuality } from "../../packages/shared/src/quality-gate.ts";
import type { NormalisedDraft } from "../../packages/shared/src/domain.ts";

function draft(partial: Partial<NormalisedDraft>): NormalisedDraft {
  return {
    resourceType: "SOLUTION",
    title: "Sample title with enough characters",
    sourceSummary: "A sufficiently long description of the innovation for quality checks to pass easily here.",
    extractedText: "Body text with additional detail about deployment and users in the field.",
    externalId: "x",
    canonicalUrl: "https://example.com/x",
    originalUrl: "https://example.com/x",
    language: "en",
    imageUrl: null,
    publishedAt: null,
    organisationName: null,
    personName: null,
    countryName: null,
    countryCode: null,
    continentName: null,
    tags: [],
    evidenceStage: "UNKNOWN",
    evidenceBasis: "UNKNOWN",
    maturityStage: "UNKNOWN",
    costLevel: "UNKNOWN",
    commercialStatus: "UNKNOWN",
    rawMetadata: {},
    etag: null,
    lastModified: null,
    ...partial,
  };
}

test("quality gate flags blocklist and short descriptions", () => {
  const junk = evaluateDraftQuality(draft({
    title: "ACCELERATING THE FUTURE",
    sourceSummary: "short",
    extractedText: "short",
  }));
  assert.equal(junk.needsReview, true);
  assert.ok(junk.reasons.includes("blocklist_title"));
  assert.ok(junk.reasons.includes("short_description"));
});

test("quality gate flags suspicious person names", () => {
  const person = evaluateDraftQuality(draft({ personName: "a a" }));
  assert.ok(person.reasons.includes("suspicious_person_name"));
  assert.equal(person.skipOrgPersonLinks, true);
});
