import assert from "node:assert/strict";
import test from "node:test";
import { createIngestSourceLoopBudget } from "../../apps/ingestor/src/ingest-loop-budget.ts";

test("createIngestSourceLoopBudget detects exhaustion", () => {
  const prev = process.env.INGEST_SOURCE_LOOP_MAX_MINUTES;
  process.env.INGEST_SOURCE_LOOP_MAX_MINUTES = "0.001";
  const started = Date.now() - 120;
  const budget = createIngestSourceLoopBudget(started);
  assert.equal(budget.exhausted(), true);
  if (prev === undefined) delete process.env.INGEST_SOURCE_LOOP_MAX_MINUTES;
  else process.env.INGEST_SOURCE_LOOP_MAX_MINUTES = prev;
});
