import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveIngestDueOnly } from "../../apps/ingestor/src/ingest-due-mode.ts";

test("manual Run now with --due ingests all enabled (not due-only)", () => {
  const prevCron = process.env.RAILWAY_CRON;
  delete process.env.RAILWAY_CRON;
  assert.equal(
    resolveIngestDueOnly({
      forcedOnly: false,
      cleanupOnly: false,
      previewEnv: undefined,
      argv: ["--due"],
    }),
    false,
  );
  if (prevCron !== undefined) process.env.RAILWAY_CRON = prevCron;
});

test("scheduled cron with --due respects due schedule", () => {
  process.env.RAILWAY_CRON = "1";
  assert.equal(
    resolveIngestDueOnly({
      forcedOnly: false,
      cleanupOnly: false,
      previewEnv: undefined,
      argv: ["--due"],
    }),
    true,
  );
  delete process.env.RAILWAY_CRON;
});
