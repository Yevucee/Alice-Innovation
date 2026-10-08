/**
 * Print sample ingest records for Asia sources. Usage:
 *   npx tsx scripts/asia-sample-records.ts --slug=edb-singapore-innovation-insights --count=10
 */
import { loadSources } from "@alice/source-registry";
import { loadDotEnv } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";

loadDotEnv();

function parseArgs(): { slug: string; count: number } {
  const slug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? "";
  const count = Number(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] ?? "10");
  return { slug, count };
}

function ctxFor(source: ReturnType<typeof loadSources>[number]): AdapterContext {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  return {
    source,
    userAgent,
    timeoutMs,
    limit: null,
    fetchText: (url) => fetchText(url, { userAgent, timeoutMs }),
  };
}

async function main(): Promise<void> {
  const { slug, count } = parseArgs();
  const source = loadSources().find((s) => s.id === slug);
  if (!source) throw new Error(`Unknown source: ${slug}`);
  const adapter = getAdapter(source.adapter);
  if (!adapter) throw new Error(`No adapter for ${source.adapter}`);
  const ctx = ctxFor(source);
  const refs = await adapter.discover({ ...ctx, limit: count * 3 });
  console.log(`# ${slug} — discovered ${refs.length}, sampling ${count}\n`);
  let printed = 0;
  for (const ref of refs) {
    if (printed >= count) break;
    try {
      const page = await adapter.fetch(ref, ctx);
      const draft = adapter.parse(page);
      const org = (draft.rawMetadata as Record<string, unknown>)?.organisation as string
        ?? (draft.rawMetadata as Record<string, unknown>)?.org as string
        ?? "—";
      console.log(`## ${printed + 1}`);
      console.log(`- **title:** ${draft.title}`);
      console.log(`- **org:** ${org}`);
      console.log(`- **description:** ${(draft.summary || draft.text || "").slice(0, 280).replace(/\n/g, " ")}`);
      console.log(`- **url:** ${draft.url}`);
      console.log("");
      printed += 1;
    } catch (error) {
      console.log(`## skip ${ref.url}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
