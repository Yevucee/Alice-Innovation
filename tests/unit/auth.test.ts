import assert from "node:assert/strict";
import { test } from "node:test";
import { authorised } from "../../apps/mcp/src/auth.ts";
import { allowRequest } from "../../apps/mcp/src/rate-limit.ts";

test("bearer auth rejects missing, wrong, and empty tokens", () => {
  assert.equal(authorised(undefined, "secret"), false);
  assert.equal(authorised("Bearer wrong", "secret"), false);
  assert.equal(authorised("Bearer secret", ""), false);
  assert.equal(authorised("Bearer secret", "secret"), true);
  assert.equal(authorised("bearer secret", "secret"), true);
});

test("rate limit allows a burst then blocks", () => {
  const key = "test-token-key";
  const now = 1_700_000_000_000;
  assert.equal(allowRequest(key, 2, now), true);
  assert.equal(allowRequest(key, 2, now), true);
  assert.equal(allowRequest(key, 2, now), false);
});
