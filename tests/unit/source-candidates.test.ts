import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultCandidateName,
  normalizeCandidateUrl,
} from "../../packages/database/src/source-candidates.ts";

test("normalizeCandidateUrl adds https and canonicalises", () => {
  assert.equal(
    normalizeCandidateUrl("Example.com/hub/"),
    "https://example.com/hub",
  );
});

test("defaultCandidateName prefers provided label", () => {
  assert.equal(defaultCandidateName("https://example.com", "My award"), "My award");
});

test("defaultCandidateName derives from hostname", () => {
  assert.equal(defaultCandidateName("https://www.techhub.example/path"), "techhub.example");
});
