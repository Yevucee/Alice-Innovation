/**
 * Reproduces pre-#87 production failure: canonicaliseUrl on legacy source_items.canonical_url
 * when building loadSourceItemListingStateMap.
 */
import { canonicaliseUrl } from "@alice/shared";

const legacyRows = [
  ": https://example-startup.com/",
  "https://www.hub71.com/startups/valid-slug",
  "",
  "not-a-url",
];

function legacyLoadListingStateMapKeys(canonicalUrls: string[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const canonical_url of canonicalUrls) {
    map.set(canonicaliseUrl(canonical_url), { id: "legacy" });
  }
  return map;
}

try {
  legacyLoadListingStateMapKeys(legacyRows);
  console.log("unexpected: no throw");
} catch (error) {
  console.error("Reproduced source-level Invalid URL:");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(0);
}
