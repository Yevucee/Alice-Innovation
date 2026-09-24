import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyDuplicate, nearDuplicateKey } from "../../packages/shared/src/dedupe.ts";

const existing = [{
  resourceId: "res-1",
  canonicalUrl: "https://example.com/pump",
  nearKey: nearDuplicateKey({ title: "Village pump", organisationName: "Sample Co", countryCode: "KE" }),
}];

test("exact canonical URL links", () => {
  const decision = classifyDuplicate({
    canonicalUrl: "https://example.com/pump/?utm_source=x",
    title: "Something else",
  }, existing);
  assert.equal(decision.action, "link");
  if (decision.action === "link") assert.equal(decision.reason, "exact_url");
});

test("same title, organisation, and country with a new URL is only a possible duplicate", () => {
  const decision = classifyDuplicate({
    canonicalUrl: "https://other.example/pump",
    title: "Village pump",
    organisationName: "Sample Co",
    countryCode: "KE",
  }, existing);
  assert.deepEqual(decision, { action: "possible_duplicate", resourceId: "res-1", reason: "near_title" });
});

test("a different title creates a new resource", () => {
  const decision = classifyDuplicate({
    canonicalUrl: "https://other.example/filter",
    title: "Sand filter",
    organisationName: "Sample Co",
    countryCode: "KE",
  }, existing);
  assert.equal(decision.action, "create");
});
