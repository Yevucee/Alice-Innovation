import assert from "node:assert/strict";
import { test } from "node:test";
import { listingContentHash, lookupListingState, type SourceItemListingState } from "../../packages/database/src/ingest-detail.ts";
import { buildDraft } from "../../apps/ingestor/src/adapters/draft.ts";
import { resolveHub71PublicUrl } from "../../apps/ingestor/src/hub71-url.ts";

const detail = "https://www.hub71.com/startups/acme";

test("listingContentHash does not throw on malformed ref.url", () => {
  const hash = listingContentHash({ url: ": https://broken.example/", externalId: "x" });
  assert.equal(typeof hash, "string");
  assert.ok(hash.length > 8);
});

test("lookupListingState skips malformed stored canonical_url keys", () => {
  const state: SourceItemListingState = {
    id: "si-1",
    resource_id: "r-1",
    listing_content_hash: "abc",
    last_fetched_at: null,
  };
  const map = new Map<string, SourceItemListingState>();
  map.set("slug-1", state);
  const found = lookupListingState(map, { url: detail, externalId: "slug-1" });
  assert.equal(found?.id, "si-1");
});

test("buildDraft drops invalid imageUrl but keeps canonical page URL", () => {
  const website = resolveHub71PublicUrl(": https://www.example.com/", detail);
  const draft = buildDraft({
    title: "Acme",
    url: website,
    externalId: "acme",
    summary: "A long enough summary for the quality gate to consider this text substantive and valid.",
    text: "A long enough summary for the quality gate to consider this text substantive and valid.",
    imageUrl: ": https://cdn.example.com/logo.png",
  });
  assert.equal(draft.canonicalUrl, "https://www.example.com/");
  assert.equal(draft.imageUrl, null);
});
