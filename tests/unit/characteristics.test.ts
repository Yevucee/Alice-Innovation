import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { capPerSource } from "../../packages/shared/src/rrf.ts";
import { parseDrawdown } from "../../apps/ingestor/src/adapters/project-drawdown.ts";
import { parseSolarImpulse } from "../../apps/ingestor/src/adapters/solar-impulse.ts";
import type { FetchedPage } from "../../apps/ingestor/src/adapters/types.ts";

function page(file: string, url: string): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    html: readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8"),
    etag: null,
    lastModified: null,
    listingOnly: false,
  };
}

test("first-five fixtures expose a title and a canonical source URL", () => {
  const solar = parseSolarImpulse(page(
    "solar-impulse-item.html",
    "https://impulse-foundation.com/solutions/solutions-explorer/portfolio/solutions/sample-burner",
  ));
  const drawdown = parseDrawdown(page("drawdown-item.html", "https://drawdown.org/explorer/sample-heat-pump"));
  assert.ok(solar.title.length > 0);
  assert.ok(solar.canonicalUrl.includes("impulse-foundation.com"));
  assert.match(drawdown.sourceSummary, /heat/i);
  assert.ok(drawdown.canonicalUrl.includes("drawdown.org"));
});

test("ten near-identical solar hits do not fill a broad explore list", () => {
  const hits = Array.from({ length: 10 }, (_, index) => ({ id: `s${index}`, sourceId: "solar-impulse" }));
  hits.push({ id: "d1", sourceId: "project-drawdown" });
  const capped = capPerSource(hits, 10, 3);
  assert.ok(capped.filter((hit) => hit.sourceId === "solar-impulse").length <= 3);
  assert.ok(capped.some((hit) => hit.sourceId === "project-drawdown"));
});
