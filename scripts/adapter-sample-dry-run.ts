import { loadSources } from "@alice/source-registry";
import { loadDotEnv, log } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";

loadDotEnv();

const SAMPLE_SIZE = 10;

function parseArgs(): { sourceIds: string[]; limit: number } {
  const sourceArg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? Number(limitArg) : SAMPLE_SIZE;
  if (!sourceArg) {
    console.error("Usage: npx tsx scripts/adapter-sample-dry-run.ts --source=<id>[,<id>...] [--limit=10]");
    process.exit(1);
  }
  return { sourceIds: sourceArg.split(",").map((s) => s.trim()).filter(Boolean), limit };
}

function buildContext(source: ReturnType<typeof loadSources>[number], limit: number): AdapterContext {
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

async function sampleSource(sourceId: string, limit: number): Promise<void> {
  const sources = loadSources();
  const source = sources.find((entry) => entry.id === sourceId);
  if (!source) {
    console.error(`Unknown source: ${sourceId}`);
    process.exitCode = 1;
    return;
  }
  const adapter = getAdapter(source.adapter);
  if (!adapter) {
    console.error(`No adapter registered for ${sourceId} (${source.adapter})`);
    process.exitCode = 1;
    return;
  }

  const ctx = buildContext(source, limit);
  console.log(`\n## ${sourceId} (adapter=${adapter.id}, enabled=${source.enabled})`);
  let refs;
  try {
    refs = await adapter.discover(ctx);
  } catch (error) {
    log("error", "adapter_sample_discover_failed", { sourceId, error: String(error) });
    process.exitCode = 1;
    return;
  }
  console.log(`discovered: ${refs.length} refs (sampling ${Math.min(limit, refs.length)})`);
  const sample = refs.slice(0, limit);
  for (const ref of sample) {
    try {
      const page = await adapter.fetch(ref, ctx);
      const draft = adapter.parse(page);
      console.log(`- ${draft.title.slice(0, 80)} | ${draft.canonicalUrl.slice(0, 100)}`);
    } catch (error) {
      console.log(`- PARSE_FAIL ${ref.url} :: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}

async function main(): Promise<void> {
  const { sourceIds, limit } = parseArgs();
  for (const sourceId of sourceIds) {
    await sampleSource(sourceId, limit);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
