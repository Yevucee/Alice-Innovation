import assert from "node:assert/strict";
import { test } from "node:test";
import { googleTranslatePageUrl, googleTranslateTextUrl } from "../../apps/web/src/lib/google-translate.ts";

test("googleTranslateTextUrl encodes title and summary", () => {
  const url = googleTranslateTextUrl("你好\n\n世界");
  assert.ok(url.startsWith("https://translate.google.com/"));
  assert.ok(url.includes("text="));
  assert.ok(url.includes("tl=en"));
});

test("googleTranslatePageUrl encodes source URL", () => {
  const url = googleTranslatePageUrl("https://example.com/page");
  assert.ok(url.includes("translate.google.com/translate"));
  assert.ok(url.includes(encodeURIComponent("https://example.com/page")));
});
