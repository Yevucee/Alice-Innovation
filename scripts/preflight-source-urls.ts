import { loadSources } from "@alice/source-registry";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

const USER_AGENT = process.env.INGESTION_USER_AGENT
  || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";

type Row = {
  id: string;
  enabled: boolean;
  status: string;
  collection_url: string | null;
  http_status: number | "error";
  ok: boolean;
  note: string;
};

function argFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function checkUrl(url: string): Promise<{ status: number | "error"; note: string }> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000)),
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

async function main(): Promise<void> {
  const onlyEnabled = !argFlag("--all");
  const onlyIds = process.argv.find((a) => a.startsWith("--sources="))?.split("=")[1]?.split(",").filter(Boolean);
  const sources = loadSources().filter((source) => {
    if (onlyIds?.length && !onlyIds.includes(source.id)) return false;
    if (onlyEnabled && !source.enabled) return false;
    return Boolean(source.collection_url);
  });

  const rows: Row[] = [];
  for (const source of sources) {
    const url = source.collection_url!;
    const { status, note } = await checkUrl(url);
    const ok = typeof status === "number" && status >= 200 && status < 400;
    rows.push({
      id: source.id,
      enabled: source.enabled,
      status: source.status,
      collection_url: url,
      http_status: status,
      ok,
      note,
    });
  }

  const failed = rows.filter((row) => !row.ok);
  console.log("| Source | OK | HTTP | collection_url |");
  console.log("|--------|---:|-----:|----------------|");
  for (const row of rows) {
    console.log(
      `| \`${row.id}\` | ${row.ok ? "yes" : "**no**"} | ${row.http_status} | ${row.collection_url} |`,
    );
  }
  console.log("");
  console.log(`Checked: ${rows.length} | failed: ${failed.length}`);
  if (failed.length) {
    log("warn", "preflight_failed_sources", { ids: failed.map((r) => r.id) });
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  log("error", "preflight_sources_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
