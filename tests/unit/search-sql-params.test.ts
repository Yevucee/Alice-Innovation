import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FILTER_PARAM_COUNT,
  FILTER_QUERY_TEXT_BIND_SQL,
  SEMANTIC_EMBEDDING_PARAM,
  SEMANTIC_MAX_DISTANCE_PARAM,
  appendSemanticQueryParams,
  filterParams,
  semanticDistancePredicateSql,
} from "../../packages/database/src/search-sql.ts";

test("filterParams length matches FILTER_PARAM_COUNT and semantic slots follow", () => {
  const base = filterParams({ query: "water filter", limit: 10, offset: 0 });
  assert.equal(base.length, FILTER_PARAM_COUNT);
  assert.equal(SEMANTIC_EMBEDDING_PARAM, 13);
  assert.equal(SEMANTIC_MAX_DISTANCE_PARAM, 14);
  const embedding = Array.from({ length: 1536 }, () => 0.01);
  const bound = appendSemanticQueryParams(base, embedding, 0.42);
  assert.equal(bound.length, FILTER_PARAM_COUNT + 2);
  assert.equal(typeof bound[9], "boolean");
  assert.ok(Array.isArray(bound[10]));
  assert.equal(bound[11], false);
  assert.equal(typeof bound[12], "string");
  assert.ok(String(bound[12]).startsWith("["));
  assert.equal(bound[13], 0.42);
});

test("semanticDistancePredicateSql uses post-filter param indices", () => {
  const sql = semanticDistancePredicateSql();
  assert.match(sql, /\$13::vector/);
  assert.match(sql, /\$14::float8/);
  assert.doesNotMatch(sql, /\$12::vector/);
});

test("FILTER_QUERY_TEXT_BIND_SQL anchors $1 for semantic-only SQL", () => {
  assert.match(FILTER_QUERY_TEXT_BIND_SQL, /\$1::text/);
});

test("qualityBrowse appends blocklist at $11 without shifting query $1", () => {
  const withQuality = filterParams({
    query: "solar",
    limit: 5,
    offset: 0,
    qualityBrowse: true,
  });
  const withoutQuality = filterParams({
    query: "solar",
    limit: 5,
    offset: 0,
    qualityBrowse: false,
  });
  assert.equal(withQuality[0], "solar");
  assert.equal(withQuality[9], true);
  assert.equal(withQuality[11], false);
  assert.equal(withoutQuality[9], false);
  assert.equal(withoutQuality[11], false);
  assert.ok(Array.isArray(withQuality[10]));
  assert.ok(Array.isArray(withoutQuality[10]));
});
