/**
 * Enable a source in config/sources.yaml after adapter verification.
 * Usage: npx tsx scripts/asia-enable-source.ts <slug> [--note "preflight text"]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: asia-enable-source.ts <slug> [--note text]");
  process.exit(1);
}
const noteIdx = process.argv.indexOf("--note");
const note = noteIdx >= 0 ? process.argv.slice(noteIdx + 1).join(" ") : `Enabled after adapter dry-run (${new Date().toISOString().slice(0, 10)}).`;

const path = join(process.cwd(), "config/sources.yaml");
let yaml = readFileSync(path, "utf8");
const blockRe = new RegExp(
  `(  - id: ${slug}\\n(?:    .+\\n)+?)(    enabled: )false(\\n    status: )PAUSED`,
  "m",
);
if (!blockRe.test(yaml)) {
  console.error(`Could not find paused source block for ${slug}`);
  process.exit(1);
}
yaml = yaml.replace(
  blockRe,
  `$1$2true$3PARTIAL`,
);
const discoveryRe = new RegExp(
  `(  - id: ${slug}\\n(?:    .+\\n)+?    discovery:\\n(?:      .+\\n)+?      notes: )"([^"]*)"`,
  "m",
);
yaml = yaml.replace(discoveryRe, `$1"${note.replace(/"/g, '\\"')}"`);
writeFileSync(path, yaml);
console.log(`Enabled ${slug} (PARTIAL, enabled=true)`);
