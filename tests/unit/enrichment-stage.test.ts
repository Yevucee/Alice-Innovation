import assert from "node:assert/strict";
import test from "node:test";
import {
  inferStageFromText,
  normaliseEnrichmentStageLabel,
  stageFromAdapterMetadata,
} from "../../packages/database/src/enrichment-stage.ts";

test("normaliseEnrichmentStageLabel maps programme vocabulary", () => {
  assert.equal(normaliseEnrichmentStageLabel("pre-seed"), "IDEA");
  assert.equal(normaliseEnrichmentStageLabel("Piloting"), "PILOT");
  assert.equal(normaliseEnrichmentStageLabel("scaled"), "SCALED");
});

test("inferStageFromText picks deployment signals", () => {
  assert.equal(inferStageFromText("Now piloting with three health clinics in Kenya"), "PILOT");
  assert.equal(inferStageFromText("Scaled operations in 12 countries"), "SCALED");
});

test("stageFromAdapterMetadata reads Solve stage field", () => {
  assert.equal(
    stageFromAdapterMetadata("mit-solve", { stage: "Currently piloting" }),
    "PILOT",
  );
});
