/**
 * Append Asia acquisition + university sources to config/sources.yaml (idempotent).
 * All new sources: category asia-innovation, enabled false, status PAUSED until adapter verified.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Entry = {
  id: string;
  seq: number;
  batch: string;
  name: string;
  homepage: string | null;
  collection_url: string | null;
  priority_first: boolean;
  duplicate_of: string | null;
  notes: string;
};

type Queue = {
  acquisition: Entry[];
  university: Entry[];
  blocked: Entry[];
};

function yamlQuote(value: string): string {
  if (/[:#{}[\],&*?]|^\s|\s$/.test(value) || value.includes('"')) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function sourceBlock(entry: Entry, tier: string): string {
  const homepage = entry.homepage ?? "https://example.invalid/";
  const collection = entry.collection_url ?? homepage;
  const status = tier === "blocked" ? "BLOCKED" : "PAUSED";
  const category = tier === "blocked" ? "general-innovation" : "asia-innovation";
  const enabled = false;
  const noteParts = [
    `Asia acquisition queue seq ${entry.seq} (${entry.batch}).`,
    entry.priority_first ? "PRIORITY_FIRST_WAVE." : "",
    entry.duplicate_of ? `duplicate_of=${entry.duplicate_of}.` : "",
    entry.notes,
    tier === "blocked" ? "Manual/reference only; do not crawl without terms review." : "Verify collection_url via npm run asia:verify before enabling.",
  ].filter(Boolean).join(" ");

  return `  - id: ${entry.id}
    name: ${yamlQuote(entry.name)}
    category: ${category}
    description: ${yamlQuote(`PAUSED: Asia source (${tier}). ${noteParts}`)}
    homepage: ${homepage}
    collection_url: ${collection}
    enabled: ${enabled}
    status: ${status}
    resource_types:
      - ORGANISATION
      - SOLUTION
      - TECHNOLOGY
      - PROJECT
    update_class: MONTHLY
    adapter: ${entry.id}
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: html
      sitemap: null
      rss: null
      notes: ${yamlQuote(noteParts)}
    limits:
      requests_per_minute: 8
      concurrency: 1
    coverage:
      historical_backfill: not-started
      notes: ${yamlQuote("Added from asia-acquisition-queue.json; adapter not verified.")}
`;
}

function main(): void {
  const queuePath = join(process.cwd(), "config/asia-acquisition-queue.json");
  const sourcesPath = join(process.cwd(), "config/sources.yaml");
  const queue = JSON.parse(readFileSync(queuePath, "utf8")) as Queue;
  let yaml = readFileSync(sourcesPath, "utf8");

  const toRegister: Array<{ entry: Entry; tier: string }> = [
    ...queue.acquisition.map((e) => ({ entry: e, tier: "acquisition" })),
    ...queue.university.map((e) => ({ entry: e, tier: "university" })),
    ...queue.blocked.map((e) => ({ entry: e, tier: "blocked" })),
  ];

  const added: string[] = [];
  const blocks: string[] = [];
  for (const { entry, tier } of toRegister) {
    if (yaml.includes(`\n  - id: ${entry.id}\n`) || yaml.includes(`- id: ${entry.id}`)) {
      continue;
    }
    blocks.push(sourceBlock(entry, tier));
    added.push(entry.id);
  }

  if (blocks.length === 0) {
    console.log("No new Asia sources to register.");
    return;
  }

  const marker = "\n  # --- Asia acquisition queue (auto-registered) ---\n";
  if (!yaml.includes("# --- Asia acquisition queue")) {
    yaml = yaml.trimEnd() + marker + blocks.join("\n") + "\n";
  } else {
    yaml = yaml.trimEnd() + "\n" + blocks.join("\n") + "\n";
  }

  writeFileSync(sourcesPath, yaml);
  console.log(`Registered ${added.length} sources: ${added.join(", ")}`);
}

main();
