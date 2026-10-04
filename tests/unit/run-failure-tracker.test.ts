import assert from "node:assert/strict";
import { test } from "node:test";
import { RunFailureTracker } from "../../apps/ingestor/src/run-failure-tracker.ts";

test("RunFailureTracker blocks URL after two failures", () => {
  const tracker = new RunFailureTracker();
  const url = "https://example.com/page";
  assert.equal(tracker.shouldSkipUrl(url), null);
  tracker.recordFailure(url, 500);
  assert.equal(tracker.shouldSkipUrl(url), null);
  tracker.recordFailure(url, 500);
  assert.equal(tracker.shouldSkipUrl(url), "url_blocked");
});

test("RunFailureTracker blocks host immediately on 401", () => {
  const tracker = new RunFailureTracker();
  const url = "https://www.norrsken.org/100";
  tracker.recordFailure(url, 401);
  assert.ok(tracker.shouldSkipUrl(url)?.startsWith("host_blocked"));
});
