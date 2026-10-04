import assert from "node:assert/strict";
import { test } from "node:test";
import { normaliseAllCapsTitle } from "../../packages/shared/src/title-case.ts";

test("normaliseAllCapsTitle preserves USA and title-cases shouty titles", () => {
  assert.equal(normaliseAllCapsTitle("ENERGY MALL FOR USA MARKETS"), "Energy Mall for USA Markets");
  assert.equal(normaliseAllCapsTitle("SamWise"), "SamWise");
});
