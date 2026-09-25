import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSources } from "../../packages/source-registry/src/load.ts";

test("the registry contains all 61 sources with homepages and no invented blanks", () => {
  const sources = loadSources(new URL("../../config/sources.yaml", import.meta.url).pathname);
  assert.equal(sources.length, 61);
  const ids = new Set(sources.map((source) => source.id));
  assert.equal(ids.size, 61);
  for (const source of sources) {
    const homepage = new URL(source.homepage);
    assert.equal(homepage.protocol, "https:");
    if (source.collection_url) {
      assert.equal(new URL(source.collection_url).protocol, "https:");
    }
    assert.ok(source.discovery.notes.length > 20);
    assert.ok(source.coverage.notes.length > 10);
    assert.equal(source.access.terms_checked, false);
  }
  const byId = Object.fromEntries(sources.map((source) => [source.id, source]));
  assert.equal(byId["project-drawdown"].status, "ACTIVE");
  assert.equal(byId["solar-impulse"].status, "PARTIAL");
  assert.equal(byId["mit-solve"].status, "PARTIAL");
  assert.equal(byId["springwise"].status, "PARTIAL");
  assert.equal(byId["engineering-for-change"].status, "BLOCKED");
  assert.equal(byId["engineering-for-change"].collection_url, null);
  assert.equal(byId["xprize"].status, "PARTIAL");
  assert.equal(byId["xprize"].enabled, true);
  const paused = sources.filter((source) => source.status === "PAUSED");
  assert.equal(byId["challenge-works"].enabled, true);
  assert.equal(byId["wipo-green"].enabled, true);
  assert.equal(paused.length, 53);
  assert.ok(paused.every((source) => source.enabled === false));
});
