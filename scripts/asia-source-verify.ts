import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

const USER_AGENT = process.env.INGESTION_USER_AGENT
  || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";

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

type VerifyRow = {
  id: string;
  seq: number;
  tier: string;
  name: string;
  url: string;
  http_status: number | "skip" | "error";
  ok: boolean;
  note: string;
};

async function checkUrl(url: string): Promise<{ status: number | "error"; note: string }> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 25000)),
    });
    if (response.status >= 200 && response.status < 400) {
      return { status: response.status, note: "" };
    }
    return { status: response.status, note: `HTTP ${response.status}` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", note: message };
  }
}

function urlsForEntry(entry: Entry): string[] {
  const urls: string[] = [];
  if (entry.collection_url) urls.push(entry.collection_url);
  else if (entry.homepage) urls.push(entry.homepage);
  return urls;
}

async function verifyEntry(entry: Entry, tier: string): Promise<VerifyRow[]> {
  const urls = urlsForEntry(entry);
  if (urls.length === 0) {
    return [{
      id: entry.id,
      seq: entry.seq,
      tier,
      name: entry.name,
      url: "(none)",
      http_status: "skip",
      ok: false,
      note: "No homepage or collection_url",
    }];
  }
  const rows: VerifyRow[] = [];
  for (const url of urls) {
    const { status, note } = await checkUrl(url);
    const ok = typeof status === "number" && status >= 200 && status < 400;
    rows.push({
      id: entry.id,
      seq: entry.seq,
      tier,
      name: entry.name,
      url,
      http_status: status,
      ok,
      note,
    });
  }
  return rows;
}

async function main(): Promise<void> {
  const onlyPriority = process.argv.includes("--priority");
  const queuePath = join(process.cwd(), "config/asia-acquisition-queue.json");
  const queue = JSON.parse(readFileSync(queuePath, "utf8")) as Queue;

  const all: Array<{ entry: Entry; tier: string }> = [
    ...queue.acquisition.map((e) => ({ entry: e, tier: "acquisition" })),
    ...queue.university.map((e) => ({ entry: e, tier: "university" })),
    ...queue.blocked.map((e) => ({ entry: e, tier: "blocked" })),
  ];

  const rows: VerifyRow[] = [];
  for (const { entry, tier } of all) {
    if (onlyPriority && !entry.priority_first && tier === "acquisition") continue;
    if (entry.duplicate_of && tier === "acquisition") {
      rows.push({
        id: entry.id,
        seq: entry.seq,
        tier,
        name: entry.name,
        url: "(duplicate)",
        http_status: "skip",
        ok: true,
        note: `duplicate_of ${entry.duplicate_of}`,
      });
      continue;
    }
    rows.push(...await verifyEntry(entry, tier));
  }

  const failed = rows.filter((r) => !r.ok && r.http_status !== "skip");
  const lines: string[] = [
    "# Asia source acquisition verification",
    "",
    `Generated: ${new Date().toISOString()}${onlyPriority ? " (priority acquisition only)" : ""}`,
    "",
    "| Seq | Tier | ID | OK | HTTP | URL | Notes |",
    "|----:|------|-----|:---:|-----:|-----|-------|",
  ];
  for (const row of rows.sort((a, b) => a.seq - b.seq || a.url.localeCompare(b.url))) {
    const ok = row.ok ? "yes" : row.http_status === "skip" ? "—" : "**no**";
    lines.push(
      `| ${row.seq} | ${row.tier} | \`${row.id}\` | ${ok} | ${row.http_status} | ${row.url.replace(/\|/g, "\\|")} | ${row.note.replace(/\|/g, "\\|")} |`,
    );
  }
  lines.push("");
  lines.push(`Checked ${rows.length} URL probes | failed: ${failed.length}`);
  lines.push("");
  lines.push("## Next ingest wave");
  lines.push("");
  lines.push("Priority acquisition IDs with HTTP 200 on collection/homepage are candidates for first adapter work (`npm run adapter:sample-dry-run -- --source=<id>`).");
  lines.push("Blocked tier (seq 87+) must not be crawled without terms review.");

  const docPath = join(process.cwd(), "docs/asia-source-acquisition.md");
  writeFileSync(docPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${docPath}`);
  console.log(`Failed probes: ${failed.length}`);
  if (failed.length) {
    log("warn", "asia_source_verify_failures", { count: failed.length });
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  log("error", "asia_source_verify_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
