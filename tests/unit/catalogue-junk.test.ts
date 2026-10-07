import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catalogueJunkReasons,
  cleanJStartupSummary,
  isCataloguePlaceholderSummary,
} from "../../packages/shared/src/catalogue-junk.ts";

test("cleanJStartupSummary strips sample text boilerplate", () => {
  const raw = "sample text sample text Startups List Corporate Number｜123 — Acme Corp builds robots.";
  const cleaned = cleanJStartupSummary(raw);
  assert.match(cleaned, /Acme Corp builds robots/);
  assert.equal(isCataloguePlaceholderSummary(cleaned), false);
});

test("catalogueJunkReasons flags author paths", () => {
  const reasons = catalogueJunkReasons({
    pathname: "/author/jane-doe",
    title: "Jane Doe",
    summary: "Editor profile",
    body: "",
  });
  assert.ok(reasons.includes("catalogue_author_bio"));
});
