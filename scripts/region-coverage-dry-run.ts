/**
 * Regional source coverage: discover dry-run + optional DB item_count / last run.
 * Usage: npx tsx scripts/region-coverage-dry-run.ts --category=africa-innovation [--discover-cap=80]
 */
import { loadSources } from "@alice/source-registry";
import { getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";

loadDotEnv();

function parseArgs(): {
  category: string | null;
  sourceIds: string[] | null;
  discoverCap: number;
  includeDisabled: boolean;
} {
  const category = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1] ?? "africa-innovation";
  const idsArg = process.argv.find((a) => a.startsWith("--ids="))?.split("=")[1];
  const sourceIds = idsArg ? idsArg.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const cap = Number(process.argv.find((a) => a.startsWith("--discover-cap="))?.split("=")[1] ?? "80");
  const includeDisabled = process.argv.includes("--include-disabled");
  return {
    category: sourceIds ? null : category,
    sourceIds,
    discoverCap: cap,
    includeDisabled,
  };
}

function classifyError(message: string): string {
  if (/403|forbidden/i.test(message)) return "403";
  if (/404|not found/i.test(message)) return "404";
  if (/robots/i.test(message)) return "robots";
  if (/429|rate/i.test(message)) return "429";
  if (/timeout|ETIMEDOUT|abort/i.test(message)) return "timeout";
  if (/no adapter/i.test(message)) return "no-adapter";
  return "error";
}

function ctxFor(source: ReturnType<typeof loadSources>[number], limit: number | null): AdapterContext {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 25000);
  return {
    source,
    userAgent,
    timeoutMs,
    limit,
    fetchText: (url) => fetchText(url, { userAgent, timeoutMs }),
  };
}

async function main(): Promise<void> {
  const { category, sourceIds, discoverCap, includeDisabled } = parseArgs();
  const pool = getPool();
  const sources = loadSources()
    .filter((s) => (sourceIds ? sourceIds.includes(s.id) : s.category === category))
    .filter((s) => includeDisabled || s.enabled || s.status === "PARTIAL" || s.status === "BLOCKED");

  const label = sourceIds ? `ids=${sourceIds.join(",")}` : category;
  console.log(`# Region coverage: ${label} (n=${sources.length})\n`);
  console.log("| slug | enabled | status | item_count | discovered | last_new | last_disc | low_reason |");
  console.log("|------|---------|--------|------------|------------|----------|-----------|------------|");

  for (const source of sources.sort((a, b) => a.id.localeCompare(b.id))) {
    const db = await pool.query<{
      item_count: number;
      items_new: number | null;
      items_discovered: number | null;
    }>(
      `SELECT s.item_count,
              ir.items_new,
              ir.items_discovered
       FROM sources s
       LEFT JOIN LATERAL (
         SELECT items_new, items_discovered FROM ingestion_runs
         WHERE source_id = s.id ORDER BY started_at DESC LIMIT 1
       ) ir ON true
       WHERE s.slug = $1`,
      [source.id],
    );
    const itemCount = db.rows[0]?.item_count ?? 0;
    const lastNew = db.rows[0]?.items_new;
    const lastDisc = db.rows[0]?.items_discovered;

    const adapter = getAdapter(source.adapter);
    let discovered = "—";
    let reason = source.enabled ? "not-run" : "disabled";

    if (!adapter) {
      reason = "no-adapter";
    } else {
      try {
        const refs = await adapter.discover(ctxFor(source, discoverCap));
        discovered = String(refs.length);
        if (refs.length === 0) reason = "zero-discover";
        else if (itemCount === 0 && source.enabled) reason = "discover-ok-not-ingested";
        else if (itemCount < refs.length / 2 && refs.length > 20) reason = "partial-ingest";
        else reason = refs.length < 5 ? "low-volume" : "ok";
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        discovered = "FAIL";
        reason = classifyError(msg);
      }
    }

    if (source.status === "BLOCKED") reason = `blocked:${reason}`;
    if (!source.enabled && source.status === "PAUSED") reason = `paused:${reason}`;

    console.log(
      `| ${source.id} | ${source.enabled} | ${source.status} | ${itemCount} | ${discovered} | ${lastNew ?? "—"} | ${lastDisc ?? "—"} | ${reason} |`,
    );
  }
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
