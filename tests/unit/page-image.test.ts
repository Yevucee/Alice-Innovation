import assert from "node:assert/strict";
import { test } from "node:test";
import { ogImageFromPage, resolvePageImageUrl } from "../../apps/ingestor/src/adapters/draft.ts";
import { looksLikeDecorativeImageUrl } from "../../apps/ingestor/src/image-validate.ts";

test("resolvePageImageUrl prefers og:image over document img", () => {
  const html = `<html><head>
    <meta property="og:image" content="https://cdn.example.com/hero.jpg" />
  </head><body><img src="/tiny.png" /></body></html>`;
  assert.equal(
    resolvePageImageUrl(html, "https://example.com/item"),
    "https://cdn.example.com/hero.jpg",
  );
});

test("resolvePageImageUrl reads JSON-LD logo when meta tags missing", () => {
  const html = `<html><head><script type="application/ld+json">{
    "@type":"Organization",
    "name":"Acme",
    "logo":"https://example.com/logo.png"
  }</script></head></html>`;
  assert.equal(ogImageFromPage(html, "https://example.com/about"), "https://example.com/logo.png");
});

test("looksLikeDecorativeImageUrl rejects favicon paths", () => {
  assert.equal(looksLikeDecorativeImageUrl("https://example.com/favicon-32x32.png"), true);
  assert.equal(looksLikeDecorativeImageUrl("https://example.com/assets/card.jpg"), false);
});
