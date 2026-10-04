import assert from "node:assert/strict";
import { test } from "node:test";
import { organisationFromStoredMetadata } from "../../packages/database/src/org-recovery-from-source.ts";

test("organisationFromStoredMetadata accepts title-matching ingest name", () => {
  const name = organisationFromStoredMetadata({
    resource_id: "1",
    title: "SamWise",
    country: null,
    source_name: "MIT Solve",
    source_slug: "mit-solve",
    source_item_id: "si",
    canonical_url: "https://example.com",
    raw_metadata: { ingest_organisation_name: "SamWise" },
  });
  assert.equal(name, "SamWise");
});

test("organisationFromStoredMetadata rejects sentence-like stored names", () => {
  const name = organisationFromStoredMetadata({
    resource_id: "1",
    title: "Life Master",
    country: null,
    source_name: "MIT Solve",
    source_slug: "mit-solve",
    source_item_id: "si",
    canonical_url: "https://example.com",
    raw_metadata: { ingest_organisation_name: "We are a family team." },
  });
  assert.equal(name, null);
});
