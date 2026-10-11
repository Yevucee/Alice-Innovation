import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_INGEST_GUARD_MS,
  adminIngestGuardAnchor,
  isAdminRequestWithinGuardWindow,
} from "../../packages/database/src/ingest-scope-bootstrap.ts";

test("adminIngestGuardAnchor prefers completed_at then started_at then requested_at", () => {
  const requested = new Date("2026-10-11T00:00:00Z");
  const started = new Date("2026-10-11T00:05:00Z");
  const completed = new Date("2026-10-11T00:30:00Z");
  assert.equal(
    adminIngestGuardAnchor({ requested_at: requested, started_at: started, completed_at: completed }).toISOString(),
    completed.toISOString(),
  );
  assert.equal(
    adminIngestGuardAnchor({ requested_at: requested, started_at: started, completed_at: null }).toISOString(),
    started.toISOString(),
  );
});

test("isAdminRequestWithinGuardWindow uses 90 minutes after anchor", () => {
  const completed = new Date("2026-10-11T01:00:00Z");
  const row = {
    requested_at: new Date("2026-10-11T00:00:00Z"),
    started_at: new Date("2026-10-11T00:10:00Z"),
    completed_at: completed,
  };
  assert.equal(
    isAdminRequestWithinGuardWindow(row, completed.getTime() + 30 * 60_000, ADMIN_INGEST_GUARD_MS),
    true,
  );
  assert.equal(
    isAdminRequestWithinGuardWindow(row, completed.getTime() + 91 * 60_000, ADMIN_INGEST_GUARD_MS),
    false,
  );
});
