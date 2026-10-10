import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMigrations,
  claimPendingIngestRequest,
  createIngestRequest,
  expireStuckIngestRequests,
  getPool,
} from "../../packages/database/src/index.ts";

test("expireStuckIngestRequests marks old pending as expired_pending", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await pool.query(`DELETE FROM ingest_requests`);
  await pool.query(
    `INSERT INTO ingest_requests (scope, trigger, status, requested_at)
     VALUES ('asia', 'admin-button', 'pending', now() - interval '25 minutes')`,
  );
  const result = await expireStuckIngestRequests(pool);
  assert.equal(result.expired_pending, 1);
  const row = await pool.query<{ status: string; error_message: string }>(
    `SELECT status, error_message FROM ingest_requests LIMIT 1`,
  );
  assert.equal(row.rows[0]?.status, "failed");
  assert.equal(row.rows[0]?.error_message, "expired_pending");
});

test("expireStuckIngestRequests marks stale running when lock not held", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await pool.query(`DELETE FROM ingest_requests`);
  await pool.query(
    `INSERT INTO ingest_requests (scope, trigger, status, requested_at, started_at)
     VALUES ('africa', 'admin-button', 'running', now() - interval '4 hours', now() - interval '4 hours')`,
  );
  const result = await expireStuckIngestRequests(pool);
  assert.equal(result.expired_running, 1);
  const row = await pool.query<{ error_message: string }>(
    `SELECT error_message FROM ingest_requests LIMIT 1`,
  );
  assert.equal(row.rows[0]?.error_message, "expired_running");
});

test("fresh pending still blocks createIngestRequest", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await pool.query(`DELETE FROM ingest_requests`);
  await pool.query(
    `INSERT INTO ingest_requests (scope, trigger, status, requested_at)
     VALUES ('asia', 'admin-button', 'pending', now() - interval '5 minutes')`,
  );
  const created = await createIngestRequest(pool, { scope: "europe", trigger: "admin-button" });
  assert.deepEqual(created, { error: "already_running" });
});

test("claimPendingIngestRequest ignores pending older than 15 minutes", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await pool.query(`DELETE FROM ingest_requests`);
  await pool.query(
    `INSERT INTO ingest_requests (scope, trigger, status, requested_at)
     VALUES ('asia', 'admin-button', 'pending', now() - interval '16 minutes')`,
  );
  const result = await claimPendingIngestRequest(pool, { cronRun: false });
  assert.equal(result.claimed, null);
  assert.ok(result.ignored.some((row) => row.reason === "pending_too_old_to_claim"));
});

test("claimPendingIngestRequest never claims on railway cron", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await pool.query(`DELETE FROM ingest_requests`);
  await pool.query(
    `INSERT INTO ingest_requests (scope, trigger, status, requested_at)
     VALUES ('asia', 'admin-button', 'pending', now() - interval '2 minutes')`,
  );
  const result = await claimPendingIngestRequest(pool, { cronRun: true });
  assert.equal(result.claimed, null);
  assert.ok(result.ignored.some((row) => row.reason === "railway_cron_never_claims"));
  const row = await pool.query<{ status: string }>(`SELECT status FROM ingest_requests LIMIT 1`);
  assert.equal(row.rows[0]?.status, "pending");
});
