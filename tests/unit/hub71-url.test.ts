import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHub71PublicUrl } from "../../apps/ingestor/src/hub71-url.ts";

const detail = "https://www.hub71.com/startups/acx";

test("resolveHub71PublicUrl falls back to detail for null website", () => {
  assert.equal(resolveHub71PublicUrl(null, detail), detail);
});

test("resolveHub71PublicUrl falls back to detail for lone hash website", () => {
  assert.equal(resolveHub71PublicUrl("#", detail), detail);
});

test("resolveHub71PublicUrl strips leading colon-space from malformed website", () => {
  assert.equal(
    resolveHub71PublicUrl(": https://www.example.com/", detail),
    "https://www.example.com/",
  );
});
