import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldAcceptSourceLimited } from "../../packages/database/src/needs-review-reconcile.ts";

test("shouldAcceptSourceLimited accepts thin listing-only rows", () => {
  const row = {
    id: "1",
    title: "Card title",
    source_summary: "short",
    extracted_index_text: "short",
    organisation_name: null,
    person_name: null,
    raw_metadata: { listing_only: true },
    source_slug: "mit-solve",
    canonical_url: "https://example.com",
  };
  assert.equal(shouldAcceptSourceLimited(["short_description", "listing_only_thin"], row), true);
});

test("shouldAcceptSourceLimited rejects fixable invalid org when not thin-only", () => {
  const row = {
    id: "2",
    title: "Acme",
    source_summary: "A".repeat(120),
    extracted_index_text: "A".repeat(120),
    organisation_name: "We are a team",
    person_name: null,
    raw_metadata: {},
    source_slug: "mit-solve",
    canonical_url: "https://example.com",
  };
  assert.equal(shouldAcceptSourceLimited(["invalid_org_name"], row), false);
});
