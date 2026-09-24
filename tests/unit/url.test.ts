import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicaliseUrl } from "../../packages/shared/src/url.ts";

test("canonicaliseUrl drops tracking, fragments, and trailing slashes", () => {
  const url = canonicaliseUrl("HTTPS://Example.com:443/Solutions/?utm_source=news&b=2&a=1#section");
  assert.equal(url, "https://example.com/Solutions?a=1&b=2");
});

test("canonicaliseUrl keeps the root slash and default-less http port", () => {
  assert.equal(canonicaliseUrl("http://example.com:80/"), "http://example.com/");
});

test("canonicaliseUrl sorts repeated query keys", () => {
  assert.equal(canonicaliseUrl("https://example.com/a?z=2&z=1"), "https://example.com/a?z=1&z=2");
});
