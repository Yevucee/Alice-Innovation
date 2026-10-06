import assert from "node:assert/strict";
import test from "node:test";
import { convertAllCapsTitleToTitleCase, looksLikeAllCapsTitle } from "../../packages/shared/src/title-case.ts";

test("convertAllCapsTitleToTitleCase preserves short acronyms", () => {
  assert.equal(
    convertAllCapsTitleToTitleCase("MIT SOLAR HOME SYSTEMS IN KENYA"),
    "MIT Solar Home Systems IN Kenya",
  );
});

test("looksLikeAllCapsTitle detects shouty titles", () => {
  assert.equal(looksLikeAllCapsTitle("SUWK TECHNOLOGIES LIMITED"), true);
  assert.equal(looksLikeAllCapsTitle("Suwk Technologies"), false);
});
