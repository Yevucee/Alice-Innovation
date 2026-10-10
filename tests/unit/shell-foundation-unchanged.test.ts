import assert from "node:assert/strict";
import test from "node:test";
import { getAdapter } from "../../apps/ingestor/src/adapters/registry.ts";
import { prepareIngestDraft } from "../../apps/ingestor/src/prepare-draft.ts";
import { loadSources } from "../../packages/source-registry/src/load.ts";
import {
  applyMigrations,
  getPool,
  upsertDraft,
} from "../../packages/database/src/index.ts";

const SAMPLE_HTML = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Acme Clean Cookstoves | Shell Foundation" />
<meta property="og:description" content="Clean cooking solutions for households." />
<meta property="og:image" content="https://shellfoundation.org/wp-content/uploads/2020/01/card.jpg?ver=1" />
</head><body><main><article class="entry-content">
<h1>Acme Clean Cookstoves</h1>
<p>We deliver affordable clean cooking technology across East Africa with measurable health outcomes.</p>
</article></main></body></html>`;

test("shell-foundation realistic HTML yields unchanged on second upsert when only og:image query changes", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const source = loadSources().find((s) => s.id === "shell-foundation");
  assert.ok(source);
  const adapter = getAdapter("shell-foundation");
  assert.ok(adapter);
  const page = {
    url: "https://shellfoundation.org/portfolio/acme-clean-cookstoves/",
    finalUrl: "https://shellfoundation.org/portfolio/acme-clean-cookstoves/",
    status: 200,
    html: SAMPLE_HTML,
    etag: null,
    lastModified: null,
    listingOnly: false,
  };
  const draft1 = prepareIngestDraft(adapter.parse(page), source);
  const pool = getPool();
  await applyMigrations(pool);
  const sourceRow = await pool.query<{ id: string }>(
    "SELECT id::text FROM sources WHERE slug = 'shell-foundation'",
  );
  if (!sourceRow.rows[0]) return;
  const run = await pool.query<{ id: string }>(
    `INSERT INTO ingestion_runs (source_id, status) VALUES ($1, 'RUNNING') RETURNING id::text`,
    [sourceRow.rows[0].id],
  );
  const runId = run.rows[0].id;
  const first = await upsertDraft(pool, "shell-foundation", draft1, runId);
  assert.equal(first.outcome, "created");

  const page2 = {
    ...page,
    html: SAMPLE_HTML.replace("?ver=1", "?ver=2"),
  };
  const draft2 = prepareIngestDraft(adapter.parse(page2), source);
  const second = await upsertDraft(pool, "shell-foundation", draft2, runId);
  assert.equal(second.outcome, "unchanged");

  const imageRow = await pool.query<{ image_url: string }>(
    `SELECT image_url FROM source_items WHERE external_id = $1`,
    [draft1.externalId],
  );
  assert.match(imageRow.rows[0]?.image_url ?? "", /card\.jpg/);
});
