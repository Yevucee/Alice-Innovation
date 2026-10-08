/**
 * Dry-run all enabled asia-innovation sources. Usage:
 *   npx tsx scripts/asia-batch-dry-run.ts [--limit=3] [--slug=foo]
 */
import { loadSources } from "@alice/source-registry";
import { loadDotEnv } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";

loadDotEnv();

function parseArgs(): { limit: number; slug: string | null } {
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "3");
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? null;
  return { limit, slug };
}

function ctxFor(source: ReturnType<typeof loadSources>[number], limit: number): AdapterContext {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  return {
    source,
    userAgent,
    timeoutMs,
    limit,
    fetchText: (url) => fetchText(url, { userAgent, timeoutMs }),
  };
}

async function main(): Promise<void> {
  const { limit, slug } = parseArgs();
  const sources = loadSources().filter((s) => s.category === "asia-innovation" && s.enabled);
  const selected = slug ? sources.filter((s) => s.id === slug) : sources;
  console.log("| source | discovered | sample_title | risk |");
  console.log("|--------|------------|--------------|------|");
  for (const source of selected.sort((a, b) => a.id.localeCompare(b.id))) {
    const adapter = getAdapter(source.adapter);
    if (!adapter) {
      console.log(`| ${source.id} | — | NO_ADAPTER | high |`);
      continue;
    }
    try {
      const refs = await adapter.discover(ctxFor(source, limit));
      let sample = "";
      if (refs[0]) {
        try {
          const page = await adapter.fetch(refs[0], ctxFor(source, limit));
          sample = adapter.parse(page).title.slice(0, 60).replace(/\|/g, "/");
        } catch {
          sample = refs[0].url.slice(0, 60);
        }
      }
      const risk = refs.length === 0 ? "zero-discover" : refs.length < 10 ? "low-volume" : "ok";
      console.log(`| ${source.id} | ${refs.length} | ${sample || "—"} | ${risk} |`);
    } catch (error) {
      const msg = (error instanceof Error ? error.message : String(error)).slice(0, 40).replace(/\|/g, "/");
      console.log(`| ${source.id} | FAIL | ${msg} | high |`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
