import assert from "node:assert/strict";
import { test } from "node:test";
import { continentNameForSlug, parsePortfolioRegionLabel } from "../../packages/taxonomy/src/geography.ts";

test("parsePortfolioRegionLabel maps Africa macro regions", () => {
  const africa = parsePortfolioRegionLabel("AFRICA • HEALTHCARE");
  assert.equal(africa.continent, "Africa");
  assert.equal(africa.locationLabel, "Africa");
  assert.equal(africa.sectorHint, "HEALTHCARE");
});

test("parsePortfolioRegionLabel maps Asia-Pacific and country names", () => {
  const asia = parsePortfolioRegionLabel("ASIA PACIFIC • FINTECH");
  assert.equal(asia.continent, "Asia");
  const india = parsePortfolioRegionLabel("INDIA • EDUCATION");
  assert.equal(india.continent, "Asia");
  assert.equal(india.countryCode, "IN");
  assert.equal(india.locationLabel, "India");
});

test("parsePortfolioRegionLabel maps Europe subregions", () => {
  const cee = parsePortfolioRegionLabel("CENTRAL AND EASTERN EUROPE • EDUCATION");
  assert.equal(cee.continent, "Europe");
  assert.match(cee.locationLabel, /Europe/i);
});

test("continentNameForSlug resolves filter slugs", () => {
  assert.equal(continentNameForSlug("africa"), "Africa");
  assert.equal(continentNameForSlug("mena"), "Middle East and North Africa");
});
