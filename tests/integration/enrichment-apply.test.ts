import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEnrichmentToResource,
  applyMigrations,
  closePool,
  enrichmentInputHash,
  getPool,
} from "../../packages/database/src/index.ts";
import { enrichResourceOnIngest } from "../../apps/ingestor/src/enrich.ts";

const databaseUrl = process.env.DATABASE_URL;

test("applyEnrichment persists country, code, and location row", { skip: !databaseUrl }, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const insert = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, active, review_status
     ) VALUES (
       'SOLUTION', 'Solar Cocoa Dryer Test', 'Dryer in Archidona, Ecuador.', 'Operates in Archidona, Ecuador for smallholders.',
       'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'en', true, 'AUTO_INGESTED'
     ) RETURNING id::text`,
  );
  const resourceId = insert.rows[0].id;
  try {
    const result = await applyEnrichmentToResource(
      pool,
      resourceId,
      { country: "Ecuador", stage: "PILOT" },
      {
        title: "Solar Cocoa Dryer Test",
        summary: "Dryer in Archidona, Ecuador.",
        text: "Operates in Archidona, Ecuador for smallholders.",
      },
    );
    assert.equal(result.outcome, "applied");
    assert.ok(result.fields.includes("country"));
    assert.ok(result.fields.includes("location"));
    const row = await pool.query(
      `SELECT primary_country_name, primary_country_code FROM resources WHERE id = $1`,
      [resourceId],
    );
    assert.equal(row.rows[0].primary_country_name, "Ecuador");
    assert.equal(row.rows[0].primary_country_code, "EC");
    const loc = await pool.query(
      `SELECT loc.country_name FROM resource_locations rl
       JOIN locations loc ON loc.id = rl.location_id WHERE rl.resource_id = $1`,
      [resourceId],
    );
    assert.equal(loc.rows.length, 1);
  } finally {
    await pool.query("DELETE FROM resources WHERE id = $1", [resourceId]);
    await closePool();
  }
});

test("enrichResourceOnIngest end-to-end with mocked OpenRouter", { skip: !databaseUrl }, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const insert = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, active, review_status
     ) VALUES (
       'SOLUTION', 'Mock LLM Cocoa', 'Summary mentions Archidona, Ecuador.', 'Body Archidona, Ecuador.',
       'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'en', true, 'AUTO_INGESTED'
     ) RETURNING id::text`,
  );
  const resourceId = insert.rows[0].id;
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ country: "Ecuador", stage: "PILOT", organisation_name: "UNKNOWN" }) } }],
        usage: { total_tokens: 42 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  try {
    const result = await enrichResourceOnIngest(
      pool,
      resourceId,
      {
        title: "Mock LLM Cocoa",
        summary: "Summary mentions Archidona, Ecuador.",
        text: "Body Archidona, Ecuador.",
        countryName: null,
        evidenceStage: "UNKNOWN",
        hasOrganisation: false,
        reviewStatus: "AUTO_INGESTED",
      },
      { fetchImpl, settings: { baseUrl: "https://example.test/v1", apiKey: "test", model: "test-model", fallbackModel: "test-model" } },
    );
    assert.equal(result.applied, true);
    const row = await pool.query(
      `SELECT primary_country_name, enrichment_outcome, enrichment_input_hash FROM resources WHERE id = $1`,
      [resourceId],
    );
    assert.equal(row.rows[0].primary_country_name, "Ecuador");
    assert.equal(row.rows[0].enrichment_outcome, "applied");
    const hash = enrichmentInputHash("Mock LLM Cocoa", "Summary mentions Archidona, Ecuador.", "Body Archidona, Ecuador.");
    assert.equal(row.rows[0].enrichment_input_hash, hash);
  } finally {
    await pool.query("DELETE FROM resources WHERE id = $1", [resourceId]);
    await closePool();
  }
});
