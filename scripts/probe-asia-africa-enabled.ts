import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";

const UA = "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
const TIMEOUT = 20000;

async function probeSource(slug: string): Promise<Record<string, unknown>> {
  const source = loadSources().find((s) => s.id === slug);
  if (!source) return { slug, error: "missing_yaml" };
  if (!source.enabled) return { slug, skipped: "disabled" };
  const adapter = getAdapter(source.adapter);
  if (!adapter) return { slug, error: `no_adapter:${source.adapter}` };
  const fetch = (url: string) =>
    fetchText(url, { userAgent: UA, timeoutMs: TIMEOUT, maxAttempts: 1 });
  try {
    const refs = await adapter.discover({
      source,
      userAgent: UA,
      timeoutMs: TIMEOUT,
      limit: 5,
      fetchText: fetch,
    });
    return {
      slug,
      adapter: source.adapter,
      collection_url: source.collection_url,
      discovered_sample: refs.length,
      sample_url: refs[0]?.url ?? null,
    };
  } catch (error) {
    return {
      slug,
      adapter: source.adapter,
      collection_url: source.collection_url,
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    };
  }
}

async function main(): Promise<void> {
  const slugs = loadSources()
    .filter((s) => s.enabled && (s.category === "asia-innovation" || s.category === "africa-innovation"))
    .map((s) => s.id)
    .sort();
  console.log("enabled_asia_africa", slugs.length);
  const results: Record<string, unknown>[] = [];
  for (const slug of slugs) {
    results.push(await probeSource(slug));
    process.stdout.write(`${slug}\n`);
  }
  const zero = results.filter((r) => r.discovered_sample === 0);
  const errors = results.filter((r) => r.error);
  console.log(JSON.stringify({ zero, errors, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
