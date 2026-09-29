import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

const REGISTRY_PATH = "config/sources.yaml";

const ENABLE_SECOND_PASS = new Set([
  "su-launchlab",
  "kenya-climate-innovation-centre",
  "kosmos-innovation-centre-ghana",
  "africa-tech-summit-showcase",
  "mest-africa-challenge",
  "milken-motsepe-innovation-prize",
  "global-startup-awards-africa",
  "flat6labs-africa",
  "growthafrica",
  "africarena",
  "africa-fintech-summit-alpha-expo",
]);

const raw = readFileSync(REGISTRY_PATH, "utf8");
const doc = parse(raw) as { sources: Array<Record<string, unknown>> };

let enabled = 0;
for (const source of doc.sources) {
  const id = source.id as string;
  if (!ENABLE_SECOND_PASS.has(id)) continue;
  source.enabled = true;
  source.status = "PARTIAL";
  const coverage = source.coverage as { notes?: string; historical_backfill?: string };
  if (coverage) {
    coverage.historical_backfill = "not-started";
    coverage.notes =
      "PARTIAL: second-pass enabled (Sep 2026). Run ingest:africa-second-pass:remote after seed.";
  }
  enabled += 1;
}

writeFileSync(REGISTRY_PATH, stringify(doc, { lineWidth: 0 }));
console.log(JSON.stringify({ enabled_second_pass: enabled, total_sources: doc.sources.length }));
