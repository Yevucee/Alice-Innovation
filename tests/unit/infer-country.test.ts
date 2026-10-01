import assert from "node:assert/strict";
import { test } from "node:test";
import { inferCountryFromText } from "../../packages/taxonomy/src/infer-country-from-text.ts";

test("inferCountryFromText parses City, Country patterns", () => {
  const inferred = inferCountryFromText("The Solar Cocoa Dryer operates in Archidona, Ecuador.");
  assert.equal(inferred.countryName, "Ecuador");
  assert.equal(inferred.countryCode, "EC");
  assert.ok(inferred.city?.includes("Archidona"));
});
