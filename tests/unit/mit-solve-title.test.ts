import assert from "node:assert/strict";
import test from "node:test";
import {
  pickMitSolveTitle,
  stripMitSolveOgTitleSuffix,
} from "../../apps/ingestor/src/adapters/mit-solve.ts";

test("stripMitSolveOgTitleSuffix removes pipe MIT Solve suffix", () => {
  assert.equal(
    stripMitSolveOgTitleSuffix("Solar Pump for Farmers | MIT Solve"),
    "Solar Pump for Farmers",
  );
});

test("pickMitSolveTitle prefers longer og:title after suffix strip", () => {
  const title = pickMitSolveTitle(
    "Solar Pump",
    "Solar Pump for Smallholder Farmers | MIT Solve",
  );
  assert.equal(title, "Solar Pump for Smallholder Farmers");
});
