import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupplementalHostBlocked,
  recordSupplementalFetch403,
  resetSupplementalFetchHostPolicy,
} from "../../apps/ingestor/src/enrichment-context-fetch.ts";

test("recordSupplementalFetch403 blocks host after three consecutive 403s", () => {
  resetSupplementalFetchHostPolicy();
  const host = "www.ideo.org";
  assert.equal(recordSupplementalFetch403(host), false);
  assert.equal(recordSupplementalFetch403(host), false);
  assert.equal(recordSupplementalFetch403(host), true);
  assert.equal(isSupplementalHostBlocked(host), true);
  assert.equal(recordSupplementalFetch403(host), true);
});
