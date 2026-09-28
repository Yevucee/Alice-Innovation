import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

const REGISTRY_PATH = "config/sources.yaml";

const ENABLE_PARTIAL = new Set([
  "startgate-um6p",
  "digital-africa",
  "ghana-climate-innovation-centre",
  "ventures-platform",
  "founders-factory-africa",
  "baobab-network",
  "injini-african-edtech-map",
  "ihub-future-of-learning",
  "oceanhub-africa",
  "norrsken-accelerator",
  "norrsken-100",
  "seedstars-africa",
  "cchub-syndicate",
  "africa-tech-festival-startup-hub",
]);

const SECOND_PASS: Array<{
  id: string;
  name: string;
  homepage: string;
  collection_url: string | null;
  adapter: string;
  notes: string;
  status?: "PAUSED" | "PARTIAL";
  access?: string;
}> = [
  {
    id: "su-launchlab",
    name: "SU LaunchLab Stellenbosch portfolio",
    homepage: "https://www.launchlab.co.za/",
    collection_url: "https://www.launchlab.co.za/portfolio/",
    adapter: "su-launchlab",
    notes: "Preflight: /portfolio/ HTTP 200. Portfolio may be iframe-embedded; adapter discovers public iframe src URLs only.",
    access: "UNVERIFIED_COLLECTION",
  },
  {
    id: "kenya-climate-innovation-centre",
    name: "Kenya Climate Innovation Centre",
    homepage: "https://kenyacic.org/",
    collection_url: "https://kenyacic.org/",
    adapter: "kenya-climate-innovation-centre",
    notes: "Preflight: kenyacic.org HTTP 200. PARTIAL: venture paths discovered via sitemap when present; no single clean alumni directory verified.",
    status: "PARTIAL",
    access: "PARTIAL",
  },
  {
    id: "kosmos-innovation-centre-ghana",
    name: "Kosmos Innovation Center Ghana",
    homepage: "https://kosmosinnovationcenter.com/",
    collection_url: "https://kosmosinnovationcenter.com/news/",
    adapter: "kosmos-innovation-centre-ghana",
    notes: "PARTIAL cohort source: challenge and finalist announcements on news/blog paths. Not a stable portfolio API.",
  },
  {
    id: "africa-tech-summit-showcase",
    name: "Africa Tech Summit Investment Showcase",
    homepage: "https://africatechsummit.com/",
    collection_url: "https://africatechsummit.com/",
    adapter: "africa-tech-summit-showcase",
    notes: "PARTIAL annual showcase cohorts published as articles. Adapter extracts cohort lines from public pages when collection URL is set.",
  },
  {
    id: "mest-africa-challenge",
    name: "MEST Africa Challenge",
    homepage: "https://mest.io/",
    collection_url: "https://mest.io/news",
    adapter: "mest-africa-challenge",
    notes: "PARTIAL prize-cycle source for pan-African finalists. Ingest announcement pages, not a portfolio database.",
  },
  {
    id: "milken-motsepe-innovation-prize",
    name: "Milken-Motsepe Innovation Prize",
    homepage: "https://milkenmotsepeprize.org/",
    collection_url: "https://milkenmotsepeprize.org/",
    adapter: "milken-motsepe-innovation-prize",
    notes: "PARTIAL prize-cycle source. Public pages list selected agriculture/energy/fintech solutions by competition year.",
  },
  {
    id: "global-startup-awards-africa",
    name: "Global Startup Awards Africa",
    homepage: "https://www.globalstartupawards.com/",
    collection_url: "https://www.globalstartupawards.com/regions/africa/",
    adapter: "global-startup-awards-africa",
    notes: "PARTIAL annual winners/finalists by category. Editorial cohort extraction only.",
  },
  {
    id: "flat6labs-africa",
    name: "Flat6Labs Africa programmes",
    homepage: "https://flat6labs.com/",
    collection_url: "https://flat6labs.com/portfolio/",
    adapter: "flat6labs-africa",
    notes: "PARTIAL: Egypt/Tunisia/Morocco programme portfolios still being consolidated. Adapter registered for public portfolio paths when present.",
  },
  {
    id: "growthafrica",
    name: "GrowthAfrica ventures",
    homepage: "https://growthafrica.com/",
    collection_url: "https://growthafrica.com/investors/portfolio-our-ventures/",
    adapter: "growthafrica",
    notes: "PARTIAL: portfolio page uses CubePortfolio JS; server HTML may be incomplete. robots allows fetch with standard bot UA.",
  },
  {
    id: "africarena",
    name: "AfricArena",
    homepage: "https://www.africarena.com/",
    collection_url: "https://www.africarena.com/",
    adapter: "africarena",
    notes: "PARTIAL event showcase source for African startup finalists. Cohort adapter on public pages.",
  },
  {
    id: "africa-fintech-summit-alpha-expo",
    name: "Africa Fintech Summit Alpha Expo",
    homepage: "https://africafintechsummit.com/",
    collection_url: "https://africafintechsummit.com/",
    adapter: "africa-fintech-summit-alpha-expo",
    notes: "PARTIAL fintech summit exhibitor/alpha expo listings. Cohort adapter until a stable catalogue is verified.",
  },
];

function templateSecondPass(entry: (typeof SECOND_PASS)[number]) {
  const status = entry.status ?? "PAUSED";
  const accessStatus = entry.access ?? "PARTIAL";
  return {
    id: entry.id,
    name: entry.name,
    category: "africa-innovation",
    description: `PARTIAL second-pass Africa source. ${entry.notes.split(".")[0]}.`,
    homepage: entry.homepage,
    collection_url: entry.collection_url,
    enabled: false,
    status,
    resource_types: ["ORGANISATION", "SOLUTION", "TECHNOLOGY", "PROJECT"],
    update_class: "MONTHLY",
    adapter: entry.adapter,
    access: {
      class: "PUBLIC",
      status: accessStatus,
      robots_checked: false,
      terms_checked: false,
    },
    discovery: {
      preferred_method: "html",
      sitemap: null,
      rss: null,
      notes: entry.notes,
    },
    limits: { requests_per_minute: 8, concurrency: 1 },
    coverage: {
      historical_backfill: "not-started",
      notes: "PAUSED until collection quality is verified. Adapter is registered for limited cohort extraction.",
    },
  };
}

const raw = readFileSync(REGISTRY_PATH, "utf8");
const doc = parse(raw) as { sources: Array<Record<string, unknown>> };
const ids = new Set(doc.sources.map((s) => s.id as string));

for (const entry of SECOND_PASS) {
  if (!ids.has(entry.id)) {
    doc.sources.push(templateSecondPass(entry));
    ids.add(entry.id);
  }
}

for (const source of doc.sources) {
  const id = source.id as string;
  if (!ENABLE_PARTIAL.has(id)) continue;
  source.enabled = true;
  source.status = "PARTIAL";
  const coverage = source.coverage as { notes?: string };
  if (coverage?.notes?.includes("PAUSED until enabled")) {
    coverage.notes = "PARTIAL: enabled after robots preflight (Sep 2026). Run limit ingest then full via africa queue.";
  }
}

writeFileSync(REGISTRY_PATH, stringify(doc, { lineWidth: 0 }));
console.log(`Registry updated: ${doc.sources.length} sources; enabled ${ENABLE_PARTIAL.size} Africa catalogues.`);
