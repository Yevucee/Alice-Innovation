import assert from "node:assert/strict";
import test from "node:test";
import { ingestProcessStartContext } from "../../apps/ingestor/src/ingest-process-context.ts";

test("ingestProcessStartContext includes railway cron and deployment fields", () => {
  const prev = {
    RAILWAY_CRON: process.env.RAILWAY_CRON,
    RAILWAY_DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
    RAILWAY_REPLICA_ID: process.env.RAILWAY_REPLICA_ID,
  };
  process.env.RAILWAY_CRON = "1";
  process.env.RAILWAY_DEPLOYMENT_ID = "dep-123";
  process.env.RAILWAY_REPLICA_ID = "rep-456";
  const ctx = ingestProcessStartContext(new Date("2026-10-11T10:00:00Z"));
  assert.equal(ctx.railway_cron, true);
  assert.equal(ctx.railway_deployment_id, "dep-123");
  assert.equal(ctx.railway_replica_id, "rep-456");
  assert.equal(ctx.process_started_at, "2026-10-11T10:00:00.000Z");
  if (prev.RAILWAY_CRON === undefined) delete process.env.RAILWAY_CRON;
  else process.env.RAILWAY_CRON = prev.RAILWAY_CRON;
  if (prev.RAILWAY_DEPLOYMENT_ID === undefined) delete process.env.RAILWAY_DEPLOYMENT_ID;
  else process.env.RAILWAY_DEPLOYMENT_ID = prev.RAILWAY_DEPLOYMENT_ID;
  if (prev.RAILWAY_REPLICA_ID === undefined) delete process.env.RAILWAY_REPLICA_ID;
  else process.env.RAILWAY_REPLICA_ID = prev.RAILWAY_REPLICA_ID;
});
