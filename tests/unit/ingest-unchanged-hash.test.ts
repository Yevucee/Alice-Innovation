import assert from "node:assert/strict";
import test from "node:test";
import { getPool, applyMigrations, upsertDraft } from "../../packages/database/src/index.ts";

test("matching content_hash counts as unchanged even when image URL query changes", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const pool = getPool();
  await applyMigrations(pool);
  const source = await pool.query<{ id: string }>(
    "SELECT id::text FROM sources WHERE slug = 'shell-foundation' LIMIT 1",
  );
  if (!source.rows[0]) return;

  const draft = {
    resourceType: "ORGANISATION" as const,
    title: "Test unchanged image",
    sourceSummary: "Summary for unchanged test",
    extractedText: "Body text for unchanged test",
    externalId: "unchanged-image-test",
    canonicalUrl: "https://shellfoundation.org/portfolio/unchanged-image-test/",
    originalUrl: "https://shellfoundation.org/portfolio/unchanged-image-test/",
    language: "en",
    imageUrl: "https://shellfoundation.org/wp-content/uploads/card.jpg?v=1",
    publishedAt: null,
    organisationName: "Test Org",
    personName: null,
    countryName: null,
    countryCode: null,
    continentName: null,
    tags: [],
    evidenceStage: "UNKNOWN" as const,
    evidenceBasis: "UNKNOWN" as const,
    maturityStage: "UNKNOWN",
    costLevel: "UNKNOWN" as const,
    commercialStatus: "UNKNOWN" as const,
    rawMetadata: {},
    etag: null,
    lastModified: null,
  };

  const run = await pool.query<{ id: string }>(
    `INSERT INTO ingestion_runs (source_id, status) VALUES ($1, 'RUNNING') RETURNING id::text`,
    [source.rows[0].id],
  );
  const runId = run.rows[0].id;

  const first = await upsertDraft(pool, "shell-foundation", draft, runId);
  assert.equal(first.outcome, "created");

  const second = await upsertDraft(pool, "shell-foundation", {
    ...draft,
    imageUrl: "https://shellfoundation.org/wp-content/uploads/card.jpg?v=2",
  }, runId);
  assert.equal(second.outcome, "unchanged");
});
