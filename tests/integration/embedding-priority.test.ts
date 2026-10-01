import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMigrations,
  closePool,
  getPool,
  runEmbeddingBackfillForResourceIds,
} from "../../packages/database/src/index.ts";

const databaseUrl = process.env.DATABASE_URL;

test("priority re-embed updates embedding hash for enriched resource", { skip: !databaseUrl }, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const insert = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, active, review_status, primary_country_name, embedding, embedding_model, embedding_version
     ) VALUES (
       'SOLUTION', 'Re-embed test', 'Summary', 'Body text',
       'PILOT', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'en', true, 'AUTO_INGESTED', 'Kenya',
       '[${Array.from({ length: 1536 }, () => "0.01").join(",")}]'::vector,
       'test-model', 'v1'
     ) RETURNING id::text`,
  );
  const resourceId = insert.rows[0].id;
  await pool.query(`UPDATE resources SET embedding_content_hash = NULL, enrichment_outcome = 'applied' WHERE id = $1`, [resourceId]);
  try {
    const result = await runEmbeddingBackfillForResourceIds(pool, [resourceId], {
      embedBatch: async (texts) => ({
        vectors: texts.map(() => Array.from({ length: 1536 }, () => 0.02)),
        usage: { total_tokens: 10 },
      }),
      model: "test-model",
      version: "v1",
      throwOnConsecutiveFailures: false,
    });
    assert.equal(result.embedded, 1);
    const row = await pool.query(`SELECT embedding_content_hash IS NOT NULL AS has_hash FROM resources WHERE id = $1`, [resourceId]);
    assert.equal(row.rows[0].has_hash, true);
  } finally {
    await pool.query("DELETE FROM resources WHERE id = $1", [resourceId]);
    await closePool();
  }
});
