import assert from "node:assert/strict";
import { test } from "node:test";
import { firstSourceIngestItemLimit, resolveIngestItemLimit } from "../../apps/ingestor/src/ingest-limits.ts";

test("resolveIngestItemLimit uses first-run cap when source never succeeded", () => {
  assert.equal(resolveIngestItemLimit({ cliLimit: null, lastSuccessfulRun: null }), firstSourceIngestItemLimit());
});

test("resolveIngestItemLimit respects explicit CLI limit", () => {
  assert.equal(resolveIngestItemLimit({ cliLimit: 12, lastSuccessfulRun: null }), 12);
  assert.equal(resolveIngestItemLimit({ cliLimit: 12, lastSuccessfulRun: new Date() }), 12);
});

test("resolveIngestItemLimit is unlimited after first success", () => {
  assert.equal(resolveIngestItemLimit({ cliLimit: null, lastSuccessfulRun: new Date() }), null);
});
