import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteHost } from "../../packages/database/src/hubs.ts";

test("websiteHost normalises hosts for deduplication", () => {
  assert.equal(websiteHost("https://www.cchub.africa/team"), "cchub.africa");
  assert.equal(websiteHost("https://CCHub.Africa"), "cchub.africa");
  assert.equal(websiteHost(""), null);
});
