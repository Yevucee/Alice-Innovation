import assert from "node:assert/strict";
import { test } from "node:test";
import { capPerSource, defaultPerSourceCap, reciprocalRankFusion } from "../../packages/shared/src/rrf.ts";

test("reciprocal rank fusion prefers documents that appear in both lists", () => {
  const fused = reciprocalRankFusion([
    { name: "full_text", hits: [{ id: "a" }, { id: "b" }] },
    { name: "semantic", hits: [{ id: "b" }, { id: "c" }] },
  ]);
  assert.equal(fused[0].id, "b");
  assert.deepEqual(fused[0].lists.sort(), ["full_text", "semantic"]);
});

test("a broad result list cannot be filled by one source", () => {
  const hits = [
    { id: "1", sourceId: "solar" },
    { id: "2", sourceId: "solar" },
    { id: "3", sourceId: "solar" },
    { id: "4", sourceId: "solar" },
    { id: "5", sourceId: "drawdown" },
    { id: "6", sourceId: "solve" },
  ];
  const capped = capPerSource(hits, 4, defaultPerSourceCap(10));
  const solar = capped.filter((hit) => hit.sourceId === "solar");
  assert.ok(solar.length <= 3);
  assert.equal(capped.length, 4);
  assert.ok(capped.some((hit) => hit.sourceId === "drawdown"));
});
