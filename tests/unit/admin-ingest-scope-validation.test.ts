import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

const scopeSchema = z.enum([
  "asia",
  "africa",
  "europe",
  "south-america",
  "grants",
  "all",
  "failed-only",
]);

test("admin ingest scope validation rejects unknown scopes", () => {
  assert.equal(scopeSchema.safeParse({ scope: "asia" }).success, false);
  assert.equal(scopeSchema.safeParse("asia").success, true);
  assert.equal(scopeSchema.safeParse("nope").success, false);
});
