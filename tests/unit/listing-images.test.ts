import assert from "node:assert/strict";
import { test } from "node:test";
import { listingCardImageUrl } from "../../apps/ingestor/src/adapters/listing-images.ts";

test("listingCardImageUrl skips placeholders and returns card logo", () => {
  const html = `
    <div class="company-information-div">
      <img class="company-logo" src="https://cdn.example.com/acme.png" />
      <img src="https://cdn.example.com/placeholder.svg" />
    </div>`;
  const url = listingCardImageUrl(html, "https://www.injini.africa/map", {
    preferSelector: "img.company-logo",
    skipPattern: /placeholder/i,
  });
  assert.equal(url, "https://cdn.example.com/acme.png");
});
