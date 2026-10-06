import assert from "node:assert/strict";
import test from "node:test";
import { inferPromotedCatalogueConfig } from "../../packages/database/src/promoted-sources.ts";

test("inferPromotedCatalogueConfig uses parent path for deep item URLs", () => {
  const cfg = inferPromotedCatalogueConfig("https://hub.example/portfolio/acme-co");
  assert.equal(cfg.siteOrigin, "https://hub.example");
  assert.match(cfg.pathPattern, /portfolio/);
  assert.match(cfg.collectionUrl, /portfolio/);
});

test("inferPromotedCatalogueConfig handles single-segment listing URLs", () => {
  const cfg = inferPromotedCatalogueConfig("https://awards.example/finalists/");
  assert.equal(cfg.pathPattern, "^/finalists/[^/]+/?$");
});
