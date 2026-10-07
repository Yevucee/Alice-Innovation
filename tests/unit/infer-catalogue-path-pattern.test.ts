import assert from "node:assert/strict";
import { test } from "node:test";
import { inferCataloguePathPatternFromCollectionUrl } from "../../packages/database/src/promoted-sources.ts";

test("inferCataloguePathPatternFromCollectionUrl anchors on collection path", () => {
  const pattern = inferCataloguePathPatternFromCollectionUrl("https://www.hkstp.org/en/directory");
  assert.match("/en/directory/acme-corp", new RegExp(pattern, "i"));
  assert.doesNotMatch("/en/discover", new RegExp(pattern, "i"));
});
