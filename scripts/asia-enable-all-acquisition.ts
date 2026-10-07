/**
 * Enable all asia-innovation acquisition sources (not BLOCKED tier).
 * Usage: npx tsx scripts/asia-enable-all-acquisition.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadSources } from "@alice/source-registry";
import { resolve } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const sources = loadSources(resolve(process.cwd(), "config/sources.yaml"));
const toEnable = sources.filter(
  (s) => s.category === "asia-innovation" && s.status !== "BLOCKED" && !s.enabled,
);

let yaml = readFileSync(join(process.cwd(), "config/sources.yaml"), "utf8");
let count = 0;

for (const source of toEnable) {
  const blockRe = new RegExp(
    `(  - id: ${source.id}\\n(?:    .+\\n)+?)(    enabled: )false(\\n    status: )PAUSED`,
    "m",
  );
  if (!blockRe.test(yaml)) continue;
  if (!dryRun) {
    yaml = yaml.replace(blockRe, `$1$2true$3PARTIAL`);
  }
  count += 1;
  console.log(dryRun ? `would enable ${source.id}` : `enabled ${source.id}`);
}

if (!dryRun && count > 0) {
  writeFileSync(join(process.cwd(), "config/sources.yaml"), yaml);
}
console.log(`\n${dryRun ? "Would enable" : "Enabled"} ${count} sources`);
