/**
 * Simulate CORDIS discover filter stages (per enabled slug).
 * Usage: npx tsx scripts/cordis-pipeline-simulate.ts
 */
import { loadSources } from "@alice/source-registry";
import { fetchJson } from "../apps/ingestor/src/adapters/open-data/http-json.js";
import { cordisHitLooksInnovationRelevant } from "../apps/ingestor/src/adapters/open-data/innovation-filter.js";

const CORDIS_SEARCH = "https://cordis.europa.eu/api/search/results";
const PAGE_SIZE = 50;
const SAMPLE_PAGES = 10;

const QUERIES: Record<string, string> = {
  "cordis-horizon-europe-projects": "contenttype='project' AND programme/term='HORIZON'",
  "cordis-horizon-2020-projects": "contenttype='project' AND programme/term='H2020'",
  "cordis-eic-accelerator-projects": "contenttype='project' AND programme/term='EIC'",
};

async function simulate(slug: string, query: string): Promise<void> {
  const ua = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1";
  let rawHits = 0;
  let afterFilter = 0;
  const seen = new Set<string>();
  let totalApi: number | null = null;

  for (let page = 1; page <= SAMPLE_PAGES; page += 1) {
    const url = `${CORDIS_SEARCH}?query=${encodeURIComponent(query)}&p=${page}&num=${PAGE_SIZE}`;
    const payload = await fetchJson<{
      payload?: { total?: number; results?: Array<{ id?: string; title?: string; teaser?: string; relatedProjectReference?: string; relatedProjectAcronym?: string }> };
    }>(url, { userAgent: ua, timeoutMs: 45_000 });
    if (totalApi === null) totalApi = payload.payload?.total ?? null;
    const hits = payload.payload?.results ?? [];
    if (hits.length === 0) break;
    for (const hit of hits) {
      rawHits += 1;
      if (!cordisHitLooksInnovationRelevant(hit)) continue;
      afterFilter += 1;
      const key = hit.relatedProjectReference?.trim() || hit.id?.trim() || "";
      if (key) seen.add(key);
    }
  }

  const cap = 500;
  const discovered = Math.min(seen.size, cap);
  console.log(`| ${slug} | api_total≈${totalApi ?? "?"} | raw_sample=${rawHits} | pass_filter_sample=${afterFilter} | unique_sample=${seen.size} | discover_cap=${discovered} |`);
}

async function main(): Promise<void> {
  const sources = loadSources().filter((s) => s.enabled && s.id.startsWith("cordis-"));
  console.log("# CORDIS filter simulation (first", SAMPLE_PAGES, "pages ×", PAGE_SIZE, "hits)\n");
  console.log("| slug | api_total | raw_sample | pass_filter | unique_sample | discover_cap |");
  console.log("|------|-----------|--------------|-------------|---------------|--------------|");
  for (const source of sources) {
    const query = QUERIES[source.id];
    if (!query) {
      console.log(`| ${source.id} | — | — | — | — | — |`);
      continue;
    }
    await simulate(source.id, query);
  }
  console.log("\nNotes: discover() caps at 500/refs; parse tags grant_record=true (hidden from default browse, still inserted).");
  console.log("Innovation filter runs at discover AND parse; failures count as items_failed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
