import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichMaxPerRun,
  isEnrichmentBudgetError,
} from "../../apps/ingestor/src/enrich.ts";

test("enrichMaxPerRun defaults to 15000", () => {
  const prev = process.env.ENRICH_MAX_PER_RUN;
  delete process.env.ENRICH_MAX_PER_RUN;
  assert.equal(enrichMaxPerRun(), 15_000);
  if (prev !== undefined) process.env.ENRICH_MAX_PER_RUN = prev;
});

test("isEnrichmentBudgetError detects OpenRouter budget responses", () => {
  assert.equal(isEnrichmentBudgetError(402, ""), true);
  assert.equal(isEnrichmentBudgetError(400, "Insufficient credits for this request"), true);
  assert.equal(isEnrichmentBudgetError(429, "rate limit"), false);
});
