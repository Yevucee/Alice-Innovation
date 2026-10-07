/**
 * Idempotently append phase-2 open-data source rows to config/sources.yaml.
 * Usage: npx tsx scripts/append-open-data-sources-to-yaml.ts --ids=cordis-eu-research-projects,eu-innovation-radar
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SourceDef = {
  id: string;
  name: string;
  homepage: string;
  collection_url: string;
  adapter: string;
  enabled: boolean;
  notes: string;
};

const DEFINITIONS: SourceDef[] = [
  {
    id: "cordis-eu-research-projects",
    name: "CORDIS EU research projects",
    homepage: "https://cordis.europa.eu/",
    collection_url: "https://cordis.europa.eu/api/search/results",
    adapter: "cordis-eu-research-projects",
    enabled: false,
    notes: "CORDIS API contenttype=project. Disabled overnight — use programme-specific CORDIS slugs.",
  },
  {
    id: "cordis-eu-research-results",
    name: "CORDIS EU research results",
    homepage: "https://cordis.europa.eu/",
    collection_url: "https://cordis.europa.eu/api/search/results",
    adapter: "cordis-eu-research-results",
    enabled: false,
    notes: "CORDIS API contenttype=result. Disabled (research outputs, not innovations).",
  },
  {
    id: "cordis-horizon-europe-projects",
    name: "CORDIS Horizon Europe projects",
    homepage: "https://cordis.europa.eu/",
    collection_url: "https://cordis.europa.eu/api/search/results",
    adapter: "cordis-horizon-europe-projects",
    enabled: true,
    notes: "CORDIS programme filter HORIZON.",
  },
  {
    id: "cordis-fp7-projects",
    name: "CORDIS FP7 projects",
    homepage: "https://cordis.europa.eu/",
    collection_url: "https://cordis.europa.eu/api/search/results",
    adapter: "cordis-fp7-projects",
    enabled: false,
    notes: "CORDIS programme filter FP7. Disabled overnight.",
  },
  {
    id: "cordis-horizon-2020-projects",
    name: "CORDIS Horizon 2020 projects",
    homepage: "https://cordis.europa.eu/",
    collection_url: "https://cordis.europa.eu/api/search/results",
    adapter: "cordis-horizon-2020-projects",
    enabled: true,
    notes: "CORDIS programme filter H2020.",
  },
  {
    id: "cordis-eic-accelerator-projects",
    name: "CORDIS EIC Accelerator projects",
    homepage: "https://cordis.europa.eu/",
    collection_url: "https://cordis.europa.eu/api/search/results",
    adapter: "cordis-eic-accelerator-projects",
    enabled: true,
    notes: "CORDIS programme filter EIC.",
  },
  {
    id: "eu-innovation-radar",
    name: "EU Innovation Radar",
    homepage: "https://innovation-radar.ec.europa.eu/",
    collection_url: "https://innovation-radar.ec.europa.eu/innoradar-api/v1/innovations",
    adapter: "eu-innovation-radar",
    enabled: false,
    notes: "Official Innovation Radar API. Enable after dry-run passes from ingestor egress (some clients see HTTP 403).",
  },
  {
    id: "nih-sbir-sttr-portfolio",
    name: "NIH RePORTER SBIR/STTR portfolio",
    homepage: "https://reporter.nih.gov/",
    collection_url: "https://api.reporter.nih.gov/v2/projects/search",
    adapter: "nih-sbir-sttr-portfolio",
    enabled: false,
    notes: "NIH RePORTER SB/ST — disabled overnight (enable later).",
  },
  {
    id: "nih-reporter-innovation-grants",
    name: "NIH RePORTER innovation grants",
    homepage: "https://reporter.nih.gov/",
    collection_url: "https://api.reporter.nih.gov/v2/projects/search",
    adapter: "nih-reporter-innovation-grants",
    enabled: false,
    notes: "NIH innovation grants — disabled overnight.",
  },
  {
    id: "nsf-awards-catalogue",
    name: "NSF awards catalogue",
    homepage: "https://www.nsf.gov/",
    collection_url: "https://api.nsf.gov/services/v1/awards.json",
    adapter: "nsf-awards-catalogue",
    enabled: false,
    notes: "NSF awards — disabled overnight.",
  },
  {
    id: "usaspending-sbir-awards",
    name: "USAspending SBIR awards",
    homepage: "https://www.usaspending.gov/",
    collection_url: "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    adapter: "usaspending-sbir-awards",
    enabled: false,
    notes: "USAspending SBIR — disabled overnight.",
  },
  {
    id: "usaspending-sttr-awards",
    name: "USAspending STTR awards",
    homepage: "https://www.usaspending.gov/",
    collection_url: "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    adapter: "usaspending-sttr-awards",
    enabled: false,
    notes: "USAspending STTR — disabled overnight.",
  },
  {
    id: "ukri-gtr-research-projects",
    name: "UKRI Gateway to Research projects",
    homepage: "https://gtr.ukri.org/",
    collection_url: "https://gtr.ukri.org/gtr/api/projects",
    adapter: "ukri-gtr-research-projects",
    enabled: false,
    notes: "UKRI GTR — disabled overnight.",
  },
  {
    id: "world-bank-development-projects",
    name: "World Bank development projects",
    homepage: "https://projects.worldbank.org/",
    collection_url: "https://search.worldbank.org/api/v2/projects",
    adapter: "world-bank-development-projects",
    enabled: false,
    notes: "World Bank projects — disabled overnight.",
  },
];

function block(def: SourceDef): string {
  const status = def.enabled ? "PARTIAL" : "PAUSED";
  return `  - id: ${def.id}
    name: ${def.name}
    category: general-innovation
    description: "OPEN DATA: ${def.notes}"
    homepage: ${def.homepage}
    collection_url: ${def.collection_url}
    enabled: ${def.enabled}
    status: ${status}
    resource_types:
      - PROJECT
      - RESEARCH
      - TECHNOLOGY
    update_class: MONTHLY
    adapter: ${def.adapter}
    access:
      class: PUBLIC
      status: OPEN
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: api
      sitemap: null
      rss: null
      notes: ${JSON.stringify(def.notes)}
    limits:
      requests_per_minute: 30
      concurrency: 1
      max_items_per_run: 500
      first_run_item_limit: 500
    coverage:
      historical_backfill: not-started
      notes: Phase 2 open-data source. Run adapter:sample-dry-run before first production ingest.
`;
}

function main(): void {
  const idsArg = process.argv.find((a) => a.startsWith("--ids="))?.split("=")[1];
  const ids = idsArg ? idsArg.split(",").map((s) => s.trim()) : DEFINITIONS.map((d) => d.id);
  const selected = DEFINITIONS.filter((d) => ids.includes(d.id));
  const path = join(process.cwd(), "config/sources.yaml");
  let yaml = readFileSync(path, "utf8");
  const added: string[] = [];
  for (const def of selected) {
    if (yaml.includes(`\n  - id: ${def.id}\n`) || yaml.includes(`- id: ${def.id}`)) {
      continue;
    }
    yaml += block(def);
    added.push(def.id);
  }
  writeFileSync(path, yaml);
  console.log(`Appended ${added.length} sources: ${added.join(", ") || "(none)"}`);
}

main();
