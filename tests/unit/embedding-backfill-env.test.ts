import assert from "node:assert/strict";
import { test } from "node:test";

test("EMBEDDING_PROVIDER does not change embedding base URL", async () => {
  const previous = {
    provider: process.env.EMBEDDING_PROVIDER,
    base: process.env.EMBEDDING_BASE_URL,
    key: process.env.EMBEDDING_API_KEY,
  };
  process.env.EMBEDDING_PROVIDER = "openai";
  process.env.EMBEDDING_BASE_URL = "https://openrouter.ai/api/v1";
  process.env.EMBEDDING_API_KEY = "test";
  const { embeddingSettings } = await import("../../packages/shared/src/embeddings.ts");
  const settings = embeddingSettings();
  assert.equal(settings.baseUrl, "https://openrouter.ai/api/v1");
  process.env.EMBEDDING_PROVIDER = previous.provider;
  process.env.EMBEDDING_BASE_URL = previous.base;
  process.env.EMBEDDING_API_KEY = previous.key;
});
