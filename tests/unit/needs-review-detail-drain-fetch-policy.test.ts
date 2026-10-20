import assert from "node:assert/strict";
import test from "node:test";
import { detailDrainRequiresSuccessfulFetch } from "../../packages/database/src/needs-review-detail-drain.ts";
import { planDetailDrainRow } from "../../apps/ingestor/src/needs-review-detail-drain-job.ts";

test("detailDrainRequiresSuccessfulFetch is false for injini listing-only source", () => {
  assert.equal(detailDrainRequiresSuccessfulFetch("injini-african-edtech-map"), false);
  assert.equal(detailDrainRequiresSuccessfulFetch("mit-solve"), true);
});

test("planDetailDrainRow returns fetch_failed when detail fetch required but failed", () => {
  const plan = planDetailDrainRow(
    "mit-solve",
    false,
    { title: "T", source_summary: "s", extracted_index_text: "s" },
    {
      title: "T",
      sourceSummary: "s",
      extractedText: "s",
      canonicalUrl: "",
      originalUrl: "",
      externalId: "",
      resourceType: "SOLUTION",
      evidenceBasis: "UNKNOWN",
      evidenceStage: "UNKNOWN",
      language: "en",
      imageUrl: null,
      publishedAt: null,
      organisationName: null,
      personName: null,
      countryName: null,
      countryCode: null,
      continentName: null,
      tags: [],
      maturityStage: "UNKNOWN",
      costLevel: "UNKNOWN",
      commercialStatus: "UNKNOWN",
      rawMetadata: {},
      etag: null,
      lastModified: null,
    },
  );
  assert.equal(plan?.kind, "fetch_failed");
});

test("planDetailDrainRow classifies listing-only source without a successful fetch", () => {
  const plan = planDetailDrainRow(
    "injini-african-edtech-map",
    false,
    { title: "Edtech Co", source_summary: "Kenya — Short.", extracted_index_text: "Kenya — Short." },
    {
      title: "Edtech Co",
      sourceSummary: "Kenya — Short.",
      extractedText: "Kenya — Short.",
      canonicalUrl: "",
      originalUrl: "",
      externalId: "",
      resourceType: "SOLUTION",
      evidenceBasis: "UNKNOWN",
      evidenceStage: "UNKNOWN",
      language: "en",
      imageUrl: null,
      publishedAt: null,
      organisationName: null,
      personName: null,
      countryName: null,
      countryCode: null,
      continentName: null,
      tags: [],
      maturityStage: "UNKNOWN",
      costLevel: "UNKNOWN",
      commercialStatus: "UNKNOWN",
      rawMetadata: {},
      etag: null,
      lastModified: null,
    },
  );
  assert.equal(plan?.kind, "classify");
});
