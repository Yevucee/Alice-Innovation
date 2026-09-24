import assert from "node:assert/strict";
import { test } from "node:test";
import { contentHash, sha256 } from "../../packages/shared/src/hash.ts";

test("sha256 is stable", () => {
  assert.equal(sha256("alice"), sha256("alice"));
  assert.notEqual(sha256("alice"), sha256("Alice"));
});

test("content hash ignores null parts and changes when text changes", () => {
  const first = contentHash(["Title", null, "body"]);
  const second = contentHash(["Title", "", "body"]);
  const third = contentHash(["Title", "", "body!"]);
  assert.equal(first, second);
  assert.notEqual(first, third);
});
