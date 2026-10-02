import assert from "node:assert/strict";
import test from "node:test";
import { parseEnrichmentPayload } from "../../packages/database/src/enrichment-parse.ts";
import { sourceExcerptDuplicatesSummary } from "../../apps/web/src/lib/format.ts";

test("parseEnrichmentPayload rejects all-UNKNOWN fields", () => {
  const parsed = parseEnrichmentPayload({
    country: "UNKNOWN",
    stage: "unknown",
    organisation_name: "N/A",
  });
  assert.equal(parsed.payload, null);
  assert.equal(parsed.error, "all_unknown");
});

test("parseEnrichmentPayload keeps Ecuador", () => {
  const parsed = parseEnrichmentPayload({ country: "Ecuador", stage: "DEPLOYED" });
  assert.equal(parsed.payload?.country, "Ecuador");
});

test("parseEnrichmentPayload unwraps one-element JSON array", () => {
  const parsed = parseEnrichmentPayload([{ country: "France", city: "UNKNOWN", stage: "PILOT" }]);
  assert.equal(parsed.payload?.country, "France");
  assert.equal(parsed.payload?.stage, "PILOT");
  assert.equal(parsed.unwrapArray, true);
});

test("sourceExcerptDuplicatesSummary matches shared prefix", () => {
  const summary = "The Solar Cocoa Dryer uses solar heat to dry cocoa beans in rural Ecuador.";
  const excerpt = `${summary} Additional source details about installation and partners.`;
  assert.equal(sourceExcerptDuplicatesSummary(summary, excerpt), true);
});
