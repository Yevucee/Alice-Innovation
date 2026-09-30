import assert from "node:assert/strict";
import { test } from "node:test";
import { countryCodeFor } from "../../packages/taxonomy/src/country-codes.ts";
import { applyGeographyDefaults } from "../../apps/ingestor/src/geo-defaults.ts";
import type { NormalisedDraft } from "../../packages/shared/src/domain.ts";
import type { SourceRecord } from "../../packages/source-registry/src/types.ts";

function minimalDraft(): NormalisedDraft {
  return {
    resourceType: "ORGANISATION",
    title: "Example",
    sourceSummary: "Summary",
    extractedText: "Text",
    externalId: "example",
    canonicalUrl: "https://example.com/a",
    originalUrl: "https://example.com/a",
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
  };
}

function source(id: string, category = "africa-innovation"): SourceRecord {
  return {
    id,
    name: id,
    category,
    description: "",
    homepage: "https://example.com",
    collection_url: null,
    enabled: true,
    status: "PARTIAL",
    resource_types: ["ORGANISATION"],
    update_class: "MONTHLY",
    adapter: id,
    access: { class: "PUBLIC", status: "UNVERIFIED", robots_checked: false, terms_checked: false },
    discovery: { preferred_method: "html", sitemap: null, rss: null, notes: "" },
    limits: { requests_per_minute: 8, concurrency: 1 },
    coverage: { historical_backfill: "not-started", notes: "" },
  };
}

test("countryCodeFor resolves additional African states", () => {
  assert.equal(countryCodeFor("Côte d'Ivoire"), "CI");
  assert.equal(countryCodeFor("Morocco"), "MA");
});

test("applyGeographyDefaults sets hub country for StartGate", () => {
  const draft = applyGeographyDefaults(minimalDraft(), source("startgate-um6p"));
  assert.equal(draft.countryName, "Morocco");
  assert.equal(draft.countryCode, "MA");
  assert.equal(draft.continentName, "Africa");
});

test("applyGeographyDefaults sets continent for generic africa-innovation source", () => {
  const draft = applyGeographyDefaults(minimalDraft(), source("some-new-africa-list"));
  assert.equal(draft.countryName, null);
  assert.equal(draft.continentName, "Africa");
});
