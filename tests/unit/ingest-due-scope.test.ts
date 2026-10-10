import assert from "node:assert/strict";
import test from "node:test";
import { effectiveIngestDueOnly } from "../../apps/ingestor/src/ingest-due-mode.ts";

test("scoped asia run ignores dueOnly even with --due cron semantics", () => {
  assert.equal(
    effectiveIngestDueOnly({
      dueOnly: true,
      ingestScope: "asia",
      forcedOnly: false,
    }),
    false,
  );
});

test("nightly scope=all keeps dueOnly when enabled", () => {
  assert.equal(
    effectiveIngestDueOnly({
      dueOnly: true,
      ingestScope: "all",
      forcedOnly: false,
    }),
    true,
  );
});

test("forced --source run never due-only", () => {
  assert.equal(
    effectiveIngestDueOnly({
      dueOnly: true,
      ingestScope: "all",
      forcedOnly: true,
    }),
    false,
  );
});
