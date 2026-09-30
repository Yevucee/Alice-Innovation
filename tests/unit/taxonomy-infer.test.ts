import assert from "node:assert/strict";
import { test } from "node:test";
import { inferTaxonomyFromText } from "../../packages/taxonomy/src/infer-from-text.ts";

test("inferTaxonomyFromText tags waste management problem and waste sector", () => {
  const result = inferTaxonomyFromText({
    title: "Plastic recycling for municipalities",
    summary: "Solid waste management and circular economy platform",
    text: "",
  });
  assert.ok(result.sectors.includes("waste"));
  assert.ok(result.problems.includes("waste-management"));
});

test("inferTaxonomyFromText tags solar technology", () => {
  const result = inferTaxonomyFromText({
    title: "Off-grid solar kits",
    summary: "Energy access for rural households",
    text: "",
  });
  assert.ok(result.sectors.includes("energy"));
  assert.ok(result.problems.includes("energy-access"));
  assert.ok(result.technologies.includes("solar"));
});
