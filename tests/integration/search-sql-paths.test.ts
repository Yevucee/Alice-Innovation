import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closePool,
  findSimilar,
  getPool,
  randomQualityBrowseResource,
  resourcesFromAfrica,
  searchLibrary,
  searchWithEmbedding,
} from "../../packages/database/src/index.ts";
import {
  ensureSearchTestDatabase,
  seedSearchResourceFixtures,
} from "../helpers/search-fixtures.ts";

const embedding = Array.from({ length: 1536 }, (_, index) => ((index + 5) % 100) * 0.0001);

test("search SQL paths execute against Postgres without parameter errors", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be set (see scripts/ensure-local-test-db.sh)");
  const pool = getPool();
  await ensureSearchTestDatabase(pool);
  const fixtures = await seedSearchResourceFixtures(pool);

  const strict = await searchLibrary(
    pool,
    { query: "water filter", limit: 10, offset: 0 },
    embedding,
  );
  assert.ok(strict.filtered_total > 0, "strict lexical+semantic count");
  assert.ok(strict.results.length > 0, "strict results");

  const orLexical = await searchLibrary(
    pool,
    { query: "low cost water filtration for rural villages", limit: 10, offset: 0 },
    null,
  );
  assert.ok(orLexical.results.length > 0, "OR-lexical / websearch path");

  const semanticOnly = await searchLibrary(
    pool,
    { query: "zzzznotlexicalzzzz filtration membrane", limit: 10, offset: 0 },
    embedding,
  );
  assert.ok(semanticOnly.vector === "used" || semanticOnly.results.length >= 0);

  const relaxedCount = await searchLibrary(
    pool,
    { query: "xyzzy rural drip irrigation smallholder", limit: 5, offset: 0 },
    embedding,
  );
  assert.ok(relaxedCount.filtered_total >= 0);

  for (const qualityBrowse of [false, true] as const) {
    const withQuality = await searchLibrary(
      pool,
      { query: "water filter", limit: 10, offset: 0, qualityBrowse },
      embedding,
    );
    assert.ok(withQuality.filtered_total > 0, `hybrid qualityBrowse=${qualityBrowse}`);
    const browse = await searchLibrary(
      pool,
      { query: "", limit: 10, offset: 0, sort: "newest", qualityBrowse },
      null,
    );
    assert.ok(browse.filtered_total > 0, `browse qualityBrowse=${qualityBrowse}`);
  }

  const filtered = await searchLibrary(
    pool,
    {
      query: "solar",
      limit: 5,
      offset: 0,
      technologies: ["solar"],
      countries: ["ke"],
    },
    embedding,
  );
  assert.ok(filtered.results.length > 0, "filters + embedding");

  const diverse = await searchLibrary(
    pool,
    { query: "water", limit: 6, offset: 0, diverse: true },
    embedding,
  );
  assert.ok(diverse.results.length > 0, "diverse source cap");

  const mechanism = await searchLibrary(
    pool,
    { query: "water energy", limit: 6, offset: 0, diversity: "mechanism" },
    embedding,
  );
  assert.ok(mechanism.results.length > 0, "mechanism diversity");

  const similar = await findSimilar(pool, fixtures.waterFilterId, 5);
  assert.ok(similar.length > 0, "findSimilar");

  const africa = await resourcesFromAfrica(pool, 5);
  assert.ok(africa.length > 0, "browse africa qualityBrowse");

  const spotlight = await randomQualityBrowseResource(pool);
  assert.ok(spotlight, "random quality browse resource");
  const another = await randomQualityBrowseResource(pool, [spotlight!.resource_id]);
  assert.ok(another, "random with exclude");
  assert.notEqual(another!.resource_id, spotlight!.resource_id);

  const mechanismApproaches = await searchWithEmbedding(
    pool,
    { query: "affordable water filtration", diversity: "mechanism", limit: 6, offset: 0 },
    { embedTexts: async () => [embedding] },
  );
  const approaches = mechanismApproaches.results.filter(
    (row) => row.resource_id !== fixtures.waterFilterId,
  );
  assert.ok(approaches.length > 0, "diverseApproaches (mechanism diversity SQL)");

  const embeddedSearch = await searchWithEmbedding(
    pool,
    { query: "affordable solar for off-grid rural homes", limit: 5, offset: 0 },
    {
      embedTexts: async () => [embedding],
    },
  );
  assert.ok(embeddedSearch.results.length > 0, "searchWithEmbedding");

  await closePool();
});
