import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyMigrations, closePool, getPool } from "../../packages/database/src/index.ts";
import { parseMitSolve } from "../../apps/ingestor/src/adapters/mit-solve.ts";
import type { FetchedPage } from "../../apps/ingestor/src/adapters/types.ts";
import { processIngestItem } from "../../apps/ingestor/src/item-pipeline.ts";

const databaseUrl = process.env.DATABASE_URL;

function page(file: string, url: string): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    html: readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8"),
    etag: null,
    lastModified: null,
    listingOnly: false,
  };
}

test("processIngestItem runs gate, enrich, embed, taxonomy in order", {
  skip: !databaseUrl,
}, async () => {
  await applyMigrations(getPool());
  const pool = getPool();
  const source = {
    id: "mit-solve",
    enabled: true,
    update_class: "WEEKLY",
    category: "global",
  } as import("@alice/source-registry").SourceRecord;

  const steps: string[] = [];
  let enrichCalled = false;
  let embedCalled = false;

  const uniqueUrl = `https://solve.mit.edu/solutions/ingest-test-${Date.now()}`;
  const parsed = parseMitSolve(page("mit-solve-item.html", uniqueUrl));
  const run = await pool.query(`INSERT INTO ingestion_runs (source_id, status)
    SELECT id, 'RUNNING' FROM sources WHERE slug = 'mit-solve' RETURNING id::text`);
  const runId = run.rows[0]?.id as string;

  const result = await processIngestItem(pool, source, parsed, runId, {
    enrichFn: async (...args) => {
      enrichCalled = true;
      return {
        applied: false,
        totalTokens: 0,
        budgetPaused: false,
        outcome: "skipped" as const,
        supplementalPagesFetched: 0,
        countryApplied: false,
        stageApplied: false,
      };
    },
    embedTextsFn: async (texts) => {
      embedCalled = true;
      assert.ok(texts[0].includes("Sample Coral"));
      return [Array.from({ length: 1536 }, () => 0.01)];
    },
  });

  steps.push(...result.steps);
  assert.ok(steps.indexOf("quality_gate") < steps.indexOf("upsert"));
  assert.ok(steps.indexOf("upsert") < steps.indexOf("taxonomy"));
  assert.ok(steps.indexOf("taxonomy") < steps.indexOf("embed"));
  assert.equal(enrichCalled, true);
  assert.equal(embedCalled, true);

  await closePool();
});
