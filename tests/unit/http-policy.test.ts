import assert from "node:assert/strict";
import { test } from "node:test";
import { isTimeoutError, shouldRetryHttpStatus } from "../../packages/shared/src/retry.ts";
import { robotsAllows } from "../../apps/ingestor/src/robots.ts";

test("retries timeouts, 429, and 5xx only", () => {
  assert.equal(shouldRetryHttpStatus(429), true);
  assert.equal(shouldRetryHttpStatus(503), true);
  assert.equal(shouldRetryHttpStatus(408), true);
  assert.equal(shouldRetryHttpStatus(401), false);
  assert.equal(shouldRetryHttpStatus(403), false);
  assert.equal(shouldRetryHttpStatus(404), false);
  assert.equal(isTimeoutError(Object.assign(new Error("timed out"), { name: "TimeoutError" })), true);
  assert.equal(isTimeoutError(new Error("not found")), false);
});

test("robots.txt empty disallow allows, and a path rule blocks", () => {
  const open = robotsAllows("User-agent: *\nDisallow:\n", "AliceInnovationLibrary/0.1", "/explorer");
  assert.equal(open.allowed, true);
  const blocked = robotsAllows("User-agent: *\nDisallow: /private\nCrawl-delay: 10\n", "AliceInnovationLibrary/0.1", "/private/item");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.crawlDelaySec, 10);
  const allowed = robotsAllows("User-agent: *\nDisallow: /private\n", "AliceInnovationLibrary/0.1", "/explorer");
  assert.equal(allowed.allowed, true);
});
