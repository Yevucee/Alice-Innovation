import assert from "node:assert/strict";
import { test } from "node:test";
import { reciprocalRankFusion } from "../../packages/shared/src/rrf.ts";

test("relaxed weights prefer semantic-only hits over weak or_lexical", () => {
  const fused = reciprocalRankFusion(
    [
      { name: "or_lexical", hits: [{ id: "weak-or" }] },
      { name: "semantic", hits: [{ id: "strong-sem" }] },
      { name: "full_text", hits: [] },
    ],
    60,
    { semantic: 3.5, or_lexical: 0.2, full_text: 1 },
  );
  assert.equal(fused[0].id, "strong-sem");
});
