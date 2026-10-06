import assert from "node:assert/strict";
import test from "node:test";
import { searchFiltersFromWebBody } from "../../apps/web/src/lib/search.ts";

test("searchFiltersFromWebBody applies relaxed Africa quality browse for empty query", () => {
  const filters = searchFiltersFromWebBody({
    query: "",
    continents: ["africa"],
    limit: 20,
    offset: 0,
    sort: "newest",
  });
  assert.equal(filters.qualityBrowse, true);
  assert.equal(filters.qualityBrowseRelaxed, true);
});

test("searchFiltersFromWebBody does not apply Africa quality when query is set", () => {
  const filters = searchFiltersFromWebBody({
    query: "solar",
    continents: ["africa"],
    limit: 20,
    offset: 0,
  });
  assert.equal(filters.qualityBrowse, undefined);
});

test("searchFiltersFromWebBody applies relaxed Asia quality browse for empty query", () => {
  const filters = searchFiltersFromWebBody({
    query: "",
    continents: ["asia"],
    limit: 20,
    offset: 0,
    sort: "newest",
  });
  assert.equal(filters.qualityBrowse, true);
  assert.equal(filters.qualityBrowseRelaxed, true);
});
