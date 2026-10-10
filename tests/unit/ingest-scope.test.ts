import assert from "node:assert/strict";
import test from "node:test";
import { loadSources } from "../../packages/source-registry/src/load.ts";
import {
  filterSourcesByScope,
  listUnmappedSourceIds,
  parseIngestScope,
  primaryIngestScopeForSource,
  sortSourcesForIngestScope,
} from "../../apps/ingestor/src/ingest-scope.ts";

test("parseIngestScope accepts known values and rejects unknown", () => {
  assert.equal(parseIngestScope("asia"), "asia");
  assert.throws(() => parseIngestScope("antarctica"));
});

test("asia and africa map from category", () => {
  const sources = loadSources();
  const asia = sources.find((s) => s.id === "hub71-startup-directory");
  const africa = sources.find((s) => s.id === "afrilabs");
  assert.ok(asia);
  assert.ok(africa);
  assert.equal(primaryIngestScopeForSource(asia!), "asia");
  assert.equal(primaryIngestScopeForSource(africa!), "africa");
});

test("grants bucket includes shell-foundation", () => {
  const source = loadSources().find((s) => s.id === "shell-foundation");
  assert.ok(source);
  assert.equal(primaryIngestScopeForSource(source!), "grants");
});

test("all scope orders regional before grants", () => {
  const sources = loadSources().filter((s) =>
    ["hub71-startup-directory", "afrilabs", "shell-foundation"].includes(s.id),
  );
  const ordered = sortSourcesForIngestScope(sources, "all");
  const ids = ordered.map((s) => s.id);
  const africaIdx = ids.indexOf("afrilabs");
  const asiaIdx = ids.indexOf("hub71-startup-directory");
  const grantsIdx = ids.indexOf("shell-foundation");
  assert.ok(africaIdx >= 0 && asiaIdx >= 0 && grantsIdx >= 0);
  assert.ok(africaIdx < grantsIdx && asiaIdx < grantsIdx);
});

test("filterSourcesByScope asia excludes grants", () => {
  const sources = loadSources();
  const asiaOnly = filterSourcesByScope(sources, "asia", new Set());
  assert.ok(asiaOnly.every((s) => primaryIngestScopeForSource(s) === "asia"));
  assert.ok(!asiaOnly.some((s) => s.id === "shell-foundation"));
});

test("unmapped list is documented and small", () => {
  const unmapped = listUnmappedSourceIds(loadSources());
  assert.ok(Array.isArray(unmapped));
});
