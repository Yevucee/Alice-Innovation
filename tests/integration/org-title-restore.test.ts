import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  applyMigrations,
  getPool,
  runRestoreTitleMatchedOrganisationsBatch,
  seedSources,
  seedTaxonomy,
} from "@alice/database";
import { loadSources } from "@alice/source-registry";

const databaseUrl = process.env.DATABASE_URL;

test("runRestoreTitleMatchedOrganisationsBatch restores title-named org on mit-solve", {
  skip: !databaseUrl,
}, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await seedTaxonomy(pool);
  await seedSources(pool, loadSources());
  const mit = await pool.query<{ id: string }>("SELECT id::text FROM sources WHERE slug = 'mit-solve'");
  const mitId = mit.rows[0]?.id;
  if (!mitId) throw new Error("missing mit-solve");

  const externalId = `restore-org-${randomUUID()}`;
  const itemUrl = `https://example.com/${externalId}`;
  const created = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, review_status, active
     ) VALUES (
       'SOLUTION', 'SamWise', 'Summary with enough length for indexing and quality checks in tests here.',
       'SamWise builds tools for community health workers in rural regions with offline support.',
       'PILOT', 'PROGRAMME_SELECTED', 'GROWING', 'LOW', 'AVAILABLE',
       'en', 'AUTO_INGESTED', true
     )
     RETURNING id::text`,
  );
  const resourceId = created.rows[0]!.id;
  await pool.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, raw_metadata_json, extracted_text, language, active, resource_id, last_fetched_at
     ) VALUES ($1, $2, $3, $3, 'SamWise', 'summary', 'hash', $4::jsonb, 'body', 'en', true, $5::uuid, now())`,
    [
      mitId,
      externalId,
      itemUrl,
      JSON.stringify({ rejected_organisation_name: "SamWise", quality_reasons: ["invalid_org_name"] }),
      resourceId,
    ],
  );
  await pool.query(
    `INSERT INTO resource_source_links (resource_id, source_item_id)
     SELECT $1::uuid, id FROM source_items WHERE external_id = $2`,
    [resourceId, externalId],
  );

  const batch = await runRestoreTitleMatchedOrganisationsBatch(pool, { offset: 0 });
  assert.ok(batch.restored >= 1);

  const linked = await pool.query<{ name: string }>(
    `SELECT o.name FROM resource_organisations ro
     JOIN organisations o ON o.id = ro.organisation_id
     WHERE ro.resource_id = $1::uuid`,
    [resourceId],
  );
  assert.equal(linked.rows[0]?.name, "SamWise");
});

test("does not invent org from title when metadata has no stored org name", {
  skip: !databaseUrl,
}, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  await seedTaxonomy(pool);
  await seedSources(pool, loadSources());
  const mit = await pool.query<{ id: string }>("SELECT id::text FROM sources WHERE slug = 'mit-solve'");
  const mitId = mit.rows[0]?.id;
  if (!mitId) throw new Error("missing mit-solve");

  const externalId = `restore-no-metadata-${randomUUID()}`;
  const itemUrl = `https://example.com/${externalId}`;
  const created = await pool.query<{ id: string }>(
    `INSERT INTO resources (
       resource_type, canonical_title, source_summary, extracted_index_text,
       evidence_stage, evidence_basis, maturity_stage, cost_level, commercial_status,
       language, review_status, active
     ) VALUES (
       'SOLUTION', 'Energy Mall', 'Summary with enough length for indexing and quality checks in tests here.',
       'Energy Mall provides retail energy access products for underserved households.',
       'PILOT', 'PROGRAMME_SELECTED', 'GROWING', 'LOW', 'AVAILABLE',
       'en', 'AUTO_INGESTED', true
     )
     RETURNING id::text`,
  );
  const resourceId = created.rows[0]!.id;
  await pool.query(
    `INSERT INTO source_items (
       source_id, external_id, canonical_url, original_url, title, source_description,
       content_hash, raw_metadata_json, extracted_text, language, active, resource_id, last_fetched_at
     ) VALUES ($1, $2, $3, $3, 'Energy Mall', 'summary', 'hash', '{}'::jsonb, 'body', 'en', true, $4::uuid, now())`,
    [mitId, externalId, itemUrl, resourceId],
  );
  await pool.query(
    `INSERT INTO resource_source_links (resource_id, source_item_id)
     SELECT $1::uuid, id FROM source_items WHERE external_id = $2`,
    [resourceId, externalId],
  );

  await runRestoreTitleMatchedOrganisationsBatch(pool, { offset: 0 });
  const linked = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM resource_organisations WHERE resource_id = $1::uuid`,
    [resourceId],
  );
  assert.equal(linked.rows[0]?.count, "0");
});
