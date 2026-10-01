import assert from "node:assert/strict";
import { test } from "node:test";
import { reciprocalRankFusion } from "../../packages/shared/src/rrf.ts";

test("RRF merges lexical and semantic lists so semantic-only hits appear in results", () => {
  const lexical = [{ id: "lex-1" }, { id: "lex-2" }];
  const semantic = Array.from({ length: 50 }, (_, index) => ({ id: `sem-${index}` }));
  const fused = reciprocalRankFusion([
    { name: "full_text", hits: lexical },
    { name: "or_lexical", hits: [] },
    { name: "semantic", hits: semantic },
  ]);
  assert.ok(fused.length >= 50);
  assert.ok(fused.some((hit) => hit.id === "sem-10"));
  assert.ok(fused.some((hit) => hit.id === "lex-1"));
});
