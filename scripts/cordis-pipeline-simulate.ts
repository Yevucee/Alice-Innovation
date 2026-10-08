/**
 * Simulate CORDIS discover filter stages (per enabled slug).
 * Usage: npx tsx scripts/cordis-pipeline-simulate.ts
 */
import { loadSources } from "@alice/source-registry";
import { fetchJson } from "../apps/ingestor/src/adapters/open-data/http-json.js";
import { cordisHitLooksInnovationRelevant } from "../apps/ingestor/src/adapters/open-data/innovation-filter.js";

const CORDIS_SEARCH_EN = "https://cordis.europa.eu/search/en";
const PAGE_SIZE = 50;
const SAMPLE_PAGES = 10;

const QUERIES: Record<string, string> = {
  "cordis-eu-research-projects": "contenttype=project",
};

async function simulate(slug: string, query: string): Promise<void> {
  const ua = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1";
  let rawHits = 0;
  let afterFilter = 0;
  const seen = new Set<string>();
  let totalApi: number | null = null;

  for (let page = 1; page <= SAMPLE_PAGES; page += 1) {
    const params = new URLSearchParams({ format: "json", q: query, p: String(page), num: String(PAGE_SIZE) });
    const url = `${CORDIS_SEARCH_EN}?${params.toString()}`;
    const payload = await fetchJson<{
      result?: { header?: { totalHits?: string } };
      hits?: { hit?: Array<{ project?: { id?: string; title?: string; teaser?: string; acronym?: string } }> };
    }>(url, { userAgent: ua, timeoutMs: 45_000 });
    if (totalApi === null) totalApi = Number(payload.result?.header?.totalHits ?? 0) || null;
    const rows = payload.hits?.hit ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const p = row.project;
      if (!p) continue;
      rawHits += 1;
      const hit = {
        title: p.title,
        teaser: p.teaser,
        relatedProjectAcronym: p.acronym,
        relatedProjectReference: p.id,
      };
      if (!cordisHitLooksInnovationRelevant(hit)) continue;
      afterFilter += 1;
      const key = p.id?.trim() || "";
      if (key) seen.add(key);
    }
  }

  const cap = 500;
  const discovered = Math.min(seen.size, cap);
  console.log(`| ${slug} | api_total≈${totalApi ?? "?"} | raw_sample=${rawHits} | pass_filter_sample=${afterFilter} | unique_sample=${seen.size} | discover_cap=${discovered} |`);
}

async function main(): Promise<void> {
  const sources = loadSources().filter((s) => s.enabled && s.id.startsWith("cordis-"));
  if (sources.length === 0) {
    console.log("No enabled cordis-* sources in sources.yaml");
    return;
  }
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
