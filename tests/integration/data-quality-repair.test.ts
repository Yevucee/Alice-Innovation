import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  applyMigrations,
  getPool,
  runDataQualityRepairBatch,
  retypeApoliticalArticles,
  seedSources,
  seedTaxonomy,
} from "@alice/database";
import { loadSources } from "@alice/source-registry";

const databaseUrl = process.env.DATABASE_URL;

async function ensureDb() {
  const pool = getPool();
  await applyMigrations(pool);
  await seedTaxonomy(pool);
  await seedSources(pool, loadSources());
  return pool;
}

async function sourceId(pool: Awaited<ReturnType<typeof getPool>>, slug: string): Promise<string> {
  const row = await pool.query<{ id: string }>("SELECT id::text FROM sources WHERE slug = $1", [slug]);
  const id = row.rows[0]?.id;
  if (!id) throw new Error(`missing source ${slug}`);
  return id;
}

test("runDataQualityRepairBatch rejects junk org and repairs summary", { skip: !databaseUrl }, async () => {
  const pool = await ensureDb();
  const mitId = await sourceId(pool, "mit-solve");

  const created = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, primary_country_name, review_status, active
     ) VALUES (
       'SOLUTION', 'CityScape', 'CityScape',
       'CityScape is an urban planning toolkit helping municipalities co-design inclusive public spaces with residents.',
       'PILOT', 'EDITORIALLY_CURATED', 'GROWING', 'LOW', 'AVAILABLE',
       'en', 'Usa', 'AUTO_INGESTED', true
     )
     RETURNING id::text`,
  );
  const resourceId = created.rows[0]!.id;
  const externalId = `dq-cityscape-${randomUUID()}`;
  const itemUrl = `https://example.com/cityscape/${externalId}`;

  const org = await pool.query<{ id: string }>(
    `INSERT INTO organisations (name, slug, country) VALUES ('MIT Solve', $1, null)
     RETURNING id::text`,
    [`mit-solve-org-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, raw_metadata_json, extracted_text, language, active, resource_id, last_fetched_at
     ) VALUES ($1, $2, $3, $3,
       'CityScape', 'CityScape', 'hash-dq', '{}'::jsonb, 'body', 'en', true, $4::uuid, now())`,
    [mitId, externalId, itemUrl, resourceId],
  );
  await pool.query(
    `INSERT INTO resource_source_links (resource_id, source_item_id)
     SELECT $1::uuid, id FROM source_items WHERE external_id = $2`,
    [resourceId, externalId],
  );
  await pool.query(
    `INSERT INTO resource_organisations (resource_id, organisation_id, relationship, is_primary)
     VALUES ($1::uuid, $2::uuid, 'DEVELOPED_BY', true)`,
    [resourceId, org.rows[0]!.id],
  );

  const batch = await runDataQualityRepairBatch(pool, { offset: 0, retypeApoliticalDone: true });
  assert.ok(batch.scanned >= 1);
  assert.ok(batch.orgs_rejected >= 1);

  const after = await pool.query<{ summary: string; country: string | null; org: string | null }>(
    `SELECT r.source_summary AS summary, r.primary_country_name AS country,
            (SELECT o.name FROM resource_organisations ro JOIN organisations o ON o.id = ro.organisation_id
             WHERE ro.resource_id = r.id LIMIT 1) AS org
     FROM resources r WHERE r.id = $1::uuid`,
    [resourceId],
  );
  assert.equal(after.rows[0]?.org, null);
  assert.notEqual(after.rows[0]?.summary, "CityScape");
  assert.equal(after.rows[0]?.country, "USA");
});

test("retypeApoliticalArticles sets ARTICLE on apolitical case studies", { skip: !databaseUrl }, async () => {
  const pool = await ensureDb();
  const apId = await sourceId(pool, "apolitical");
  const created = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, review_status, active
     ) VALUES (
       'CASE_STUDY', 'When Confidence Takes a Leave of Absence',
       'An opinion essay on leadership vacuums in public institutions and how teams adapt.',
       'An opinion essay on leadership vacuums in public institutions and how teams adapt with more text.',
       'UNKNOWN', 'EDITORIALLY_CURATED', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN',
       'en', 'AUTO_INGESTED', true
     )
     RETURNING id::text`,
  );
  const resourceId = created.rows[0]!.id;
  const externalId = `dq-apolitical-${randomUUID()}`;
  const itemUrl = `https://apolitical.co/x/${externalId}`;
  await pool.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, raw_metadata_json, extracted_text, language, active, resource_id, last_fetched_at
     ) VALUES ($1, $2, $3, $3,
       'When Confidence Takes a Leave of Absence', 'summary', 'hash-ap', '{}'::jsonb, 'body', 'en', true, $4::uuid, now())`,
    [apId, externalId, itemUrl, resourceId],
  );
  await pool.query(
    `INSERT INTO resource_source_links (resource_id, source_item_id)
     SELECT $1::uuid, id FROM source_items WHERE external_id = $2`,
    [resourceId, externalId],
  );

  const updated = await retypeApoliticalArticles(pool);
  assert.ok(updated >= 1);
  const type = await pool.query<{ resource_type: string }>(
    `SELECT resource_type FROM resources WHERE id = $1::uuid`,
    [resourceId],
  );
  assert.equal(type.rows[0]?.resource_type, "ARTICLE");
});
