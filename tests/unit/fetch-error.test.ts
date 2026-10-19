import assert from "node:assert/strict";
import test from "node:test";
import { formatFetchError } from "../../apps/ingestor/src/fetch-error.js";

test("formatFetchError appends ENOTFOUND cause from TypeError fetch failed", () => {
  const cause = Object.assign(new Error("getaddrinfo ENOTFOUND ofertatecnologica.secyt.unc.edu.ar"), {
    code: "ENOTFOUND",
    syscall: "getaddrinfo",
    hostname: "ofertatecnologica.secyt.unc.edu.ar",
  });
  const error = new TypeError("fetch failed", { cause });
  const formatted = formatFetchError(error);
  assert.match(formatted, /fetch failed \(cause: ENOTFOUND getaddrinfo ofertatecnologica\.secyt\.unc\.edu\.ar\)/);
});

test("formatFetchError walks nested causes", () => {
  const inner = Object.assign(new Error("connection refused"), {
    code: "ECONNREFUSED",
    syscall: "connect",
    hostname: "example.test",
  });
  const middle = new Error("connect failed", { cause: inner });
  const error = new TypeError("fetch failed", { cause: middle });
  const formatted = formatFetchError(error);
  assert.match(formatted, /fetch failed \(cause: connect failed -> ECONNREFUSED connect example\.test\)/);
});

test("formatFetchError strips query strings from URLs in message", () => {
  const error = new Error("HTTP 500 for https://example.com/path?secret=1&token=abc");
  const formatted = formatFetchError(error);
  assert.ok(!formatted.includes("secret=1"));
  assert.ok(formatted.includes("https://example.com/path"));
});

test("formatFetchError caps length at 240 characters", () => {
  const longHost = `${"a".repeat(300)}.example.com`;
  const cause = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
    code: "ENOTFOUND",
    syscall: "getaddrinfo",
    hostname: longHost,
  });
  const error = new TypeError("fetch failed", { cause });
  const formatted = formatFetchError(error);
  assert.equal(formatted.length, 240);
  assert.ok(formatted.endsWith("..."));
});
