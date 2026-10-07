import assert from "node:assert/strict";
import { test } from "node:test";
import { likelyNeedsTranslation } from "../../apps/web/src/lib/needs-translation.ts";

test("likelyNeedsTranslation detects Chinese script", () => {
  assert.equal(likelyNeedsTranslation("Putong 痰液阻塞", "en"), true);
});

test("likelyNeedsTranslation respects non-en language code", () => {
  assert.equal(likelyNeedsTranslation("Hello world", "zh"), true);
});

test("likelyNeedsTranslation skips plain English", () => {
  assert.equal(likelyNeedsTranslation("Solar irrigation for smallholders", "en"), false);
});
