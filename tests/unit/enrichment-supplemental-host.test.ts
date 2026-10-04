import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupplementalHostBlocked,
  recordSupplementalFetch403,
  resetSupplementalFetchHostPolicy,
} from "../../apps/ingestor/src/enrichment-context-fetch.ts";

test("recordSupplementalFetch403 blocks host immediately on 401/403/429", () => {
  resetSupplementalFetchHostPolicy();
  const host = "www.ideo.org";
  assert.equal(recordSupplementalFetch403(host, 403), true);
  assert.equal(isSupplementalHostBlocked(host), true);
});

test("recordSupplementalFetch403 blocks host after three consecutive non-auth failures", () => {
  resetSupplementalFetchHostPolicy();
  const host = "slow.example";
  assert.equal(recordSupplementalFetch403(host, 404), false);
  assert.equal(recordSupplementalFetch403(host, 404), false);
  assert.equal(recordSupplementalFetch403(host, 404), true);
  assert.equal(isSupplementalHostBlocked(host), true);
});
