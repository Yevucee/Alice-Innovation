import assert from "node:assert/strict";
import test from "node:test";
import { resolveEnrichmentSectorSlug } from "../../packages/database/src/enrichment-parse.ts";

test("resolveEnrichmentSectorSlug rejects LLM Water for solar subscription", () => {
  const slug = resolveEnrichmentSectorSlug("Water", {
    title: "Zilo Green Energy",
    summary: "Solar subscription service for households with off-grid electrification.",
    text: "Customers pay monthly for solar home systems and battery storage.",
  });
  assert.notEqual(slug, "water");
  assert.equal(slug, "energy");
});

test("resolveEnrichmentSectorSlug maps waste app away from Water", () => {
  const slug = resolveEnrichmentSectorSlug("Water", {
    title: "ZeLoop",
    summary: "Mobile app rewarding recycling and waste collection in communities.",
    text: "Users earn points for plastic waste and e-waste drop-offs.",
  });
  assert.notEqual(slug, "water");
  assert.equal(slug, "waste");
});

test("resolveEnrichmentSectorSlug maps renewable sourcing platform to energy", () => {
  const slug = resolveEnrichmentSectorSlug("Water", {
    title: "Zeigo Platform",
    summary: "Renewable energy sourcing and power purchase agreements for corporates.",
    text: "Solar and wind procurement platform for commercial renewable energy.",
  });
  assert.equal(slug, "energy");
});
