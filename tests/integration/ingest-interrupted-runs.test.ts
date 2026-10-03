import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMigrations,
  closePool,
  getPool,
  markInterruptedIngestionRuns,
} from "../../packages/database/src/index.ts";

const databaseUrl = process.env.DATABASE_URL;

test("markInterruptedIngestionRuns closes RUNNING runs older than process start", {
  skip: !databaseUrl,
}, async () => {
  await applyMigrations(getPool());
  const pool = getPool();
  const processStart = new Date();
  const source = await pool.query<{ id: string }>(`SELECT id::text FROM sources WHERE slug = 'mit-solve' LIMIT 1`);
  const sourceId = source.rows[0]?.id;
  assert.ok(sourceId);

  const stale = await pool.query<{ id: string }>(
    `INSERT INTO ingestion_runs (source_id, status, started_at)
     VALUES ($1, 'RUNNING', now() - interval '1 hour')
     RETURNING id::text`,
    [sourceId],
  );
  const staleId = stale.rows[0]?.id as string;

  const closed = await markInterruptedIngestionRuns(pool, processStart);
  assert.ok(closed >= 1);

  const row = await pool.query<{ status: string }>(`SELECT status FROM ingestion_runs WHERE id = $1`, [staleId]);
  assert.equal(row.rows[0]?.status, "INTERRUPTED");

  await closePool();
});
