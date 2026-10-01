import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  closePool,
  getPool,
  searchLibrary,
  searchWithEmbedding,
} from "../../packages/database/src/index.ts";
import type { Queryable } from "../../packages/database/src/pool.ts";
import { topResultsMatchPattern } from "../search-quality/relevance.ts";
import { ensureSearchTestDatabase, seedSearchResourceFixtures } from "../helpers/search-fixtures.ts";

test("searchWithEmbedding invokes injected embedTexts", async () => {
  let invoked = false;
  const stubDb = {
    query: async () => ({ rows: [] }),
  } as unknown as Queryable;
  await searchWithEmbedding(
    stubDb,
    { query: "water filter", limit: 5, offset: 0 },
    {
      embedTexts: async (texts) => {
        invoked = true;
        assert.equal(texts[0], "water filter");
        return [Array.from({ length: 1536 }, (_, index) => index * 0.0001)];
      },
    },
  );
  assert.equal(invoked, true);
});

const qualityQueries = JSON.parse(
  readFileSync(new URL("../search-quality/queries.json", import.meta.url), "utf8"),
) as Array<{
  id: string;
  query: string;
  min_results: number;
  top_n_relevance?: number;
  relevance_pattern?: string;
}>;

test("searchLibrary with embedding and qualityBrowse does not hit text[]/vector cast", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be set");
  const pool = getPool();
  await ensureSearchTestDatabase(pool);
  await seedSearchResourceFixtures(pool);
  const embedding = Array.from({ length: 1536 }, (_, index) => (index % 100) * 0.0001);
  for (const qualityBrowse of [false, true] as const) {
    const found = await searchLibrary(
      pool,
      { query: "water filter", limit: 10, offset: 0, qualityBrowse },
      embedding,
    );
    assert.ok(found.filtered_total > 0, `qualityBrowse=${qualityBrowse} filtered_total`);
    assert.ok(found.results.length > 0, `qualityBrowse=${qualityBrowse} results`);
  }
  await closePool();
});

test("search quality queries return results when embeddings are configured", {
  skip: !process.env.EMBEDDING_API_KEY,
}, async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be set");
  const pool = getPool();
  const failures: string[] = [];
  for (const entry of qualityQueries) {
    const found = await searchWithEmbedding(pool, {
      query: entry.query,
      limit: 10,
      offset: 0,
    });
    if (found.results.length < entry.min_results) {
      failures.push(`${entry.id}: got ${found.results.length}`);
    }
    if (entry.relevance_pattern && entry.top_n_relevance) {
      const pattern = new RegExp(entry.relevance_pattern, "i");
      if (!topResultsMatchPattern(found.results, pattern, entry.top_n_relevance)) {
        failures.push(`${entry.id}: top ${entry.top_n_relevance} not on-topic`);
      }
    }
  }
  await closePool();
  assert.equal(failures.length, 0, failures.join("; "));
});
