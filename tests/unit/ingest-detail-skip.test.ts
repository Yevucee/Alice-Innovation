import assert from "node:assert/strict";
import test from "node:test";
import {
  listingContentHash,
  shouldSkipDetailFetch,
} from "../../packages/database/src/ingest-detail.ts";

test("listingContentHash changes when listingHtml changes", () => {
  const base = listingContentHash({ url: "https://example.com/a", externalId: "a" });
  const withListing = listingContentHash({
    url: "https://example.com/a",
    externalId: "a",
    listingHtml: "<div>card</div>",
  });
  assert.notEqual(base, withListing);
});

test("shouldSkipDetailFetch requires matching listing hash and recent fetch", () => {
  const hash = listingContentHash({ url: "https://example.com/item", externalId: "x" });
  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  assert.equal(
    shouldSkipDetailFetch(
      {
        id: "1",
        resource_id: "r1",
        listing_content_hash: hash,
        last_fetched_at: recent,
      },
      hash,
      7,
    ),
    true,
  );
  assert.equal(
    shouldSkipDetailFetch(
      {
        id: "1",
        resource_id: "r1",
        listing_content_hash: "other",
        last_fetched_at: recent,
      },
      hash,
      7,
    ),
    false,
  );
  assert.equal(
    shouldSkipDetailFetch(
      {
        id: "1",
        resource_id: "r1",
        listing_content_hash: null,
        last_fetched_at: recent,
      },
      hash,
      7,
    ),
    false,
  );
});
