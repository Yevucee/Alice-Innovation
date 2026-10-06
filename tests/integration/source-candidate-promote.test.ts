import assert from "node:assert/strict";
import test from "node:test";
import { applyMigrations, closePool, getPool, insertSourceCandidate, promoteSourceCandidateToIngest } from "../../packages/database/src/index.ts";

test("promoteSourceCandidateToIngest creates enabled source and config", async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const { row: candidate } = await insertSourceCandidate(pool, {
    url: "https://promote-test.example/innovations/alpha",
    name: "Promote test hub",
    notes: "integration",
    suggestedBy: "test",
  });
  const promoted = await promoteSourceCandidateToIngest(pool, candidate.id);
  assert.ok(promoted.source_slug);
  assert.equal(promoted.row.status, "PROMOTED");
  assert.equal(promoted.row.source_slug, promoted.source_slug);

  const source = await pool.query<{ enabled: boolean; adapter_type: string }>(
    `SELECT enabled, adapter_type FROM sources WHERE slug = $1`,
    [promoted.source_slug],
  );
  assert.equal(source.rows[0]?.enabled, true);
  assert.equal(source.rows[0]?.adapter_type, promoted.source_slug);

  const config = await pool.query(`SELECT 1 FROM promoted_source_catalogue_configs WHERE source_slug = $1`, [
    promoted.source_slug,
  ]);
  assert.equal(config.rows.length, 1);

  await closePool();
});
