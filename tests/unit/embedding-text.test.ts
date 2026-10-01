import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEmbeddingText, embeddingTextContentHash } from "../../packages/database/src/embedding-text.ts";

test("buildEmbeddingText includes taxonomy and long interpretation", () => {
  const text = buildEmbeddingText({
    canonical_title: "Village filter",
    source_summary: "Low-cost ceramic filter",
    extracted_index_text: "Details about deployment.",
    primary_country_name: "Kenya",
    countries: ["Kenya", "Uganda"],
    problems: ["Drinking water"],
    sectors: ["Water"],
    technologies: ["Filtration"],
    interpretation_problem_statement: "Rural communities lack safe drinking water at household scale.",
  });
  assert.match(text, /Village filter/);
  assert.match(text, /Problems: Drinking water/);
  assert.match(text, /Technologies: Filtration/);
  assert.match(text, /Location: Kenya/);
  assert.match(text, /Problem statement:/);
});

test("buildEmbeddingText skips short interpretation", () => {
  const text = buildEmbeddingText({
    canonical_title: "A",
    source_summary: "B",
    extracted_index_text: "C",
    interpretation_problem_statement: "Too short",
  });
  assert.doesNotMatch(text, /Problem statement:/);
});

test("embeddingTextContentHash is stable", () => {
  const a = embeddingTextContentHash("hello");
  const b = embeddingTextContentHash("hello");
  assert.equal(a, b);
});
