import assert from "node:assert/strict";
import { test } from "node:test";
import { embeddingSupportsDimensionsParam } from "../../packages/shared/src/embeddings.ts";

test("OpenRouter openai/text-embedding-3-small supports dimensions param", () => {
  assert.equal(embeddingSupportsDimensionsParam("openai/text-embedding-3-small"), true);
});

test("legacy model id without prefix supports dimensions", () => {
  assert.equal(embeddingSupportsDimensionsParam("text-embedding-3-small"), true);
});
