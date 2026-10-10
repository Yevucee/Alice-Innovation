import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";

const SLUGS = [
  "accelerating-asia",
  "astana-hub-company-network",
  "astana-hub-startup-programmes",
  "atal-incubation-centres",
  "birac-bionest",
  "cradle-fund",
  "cradle-seed-ventures",
  "hicool",
  "hkust-innovation",
  "iit-bombay-innovation",
  "iit-kanpur-innovation",
  "iit-madras-innovation",
  "indigo-indonesia",
  "insignia-ventures-partners",
  "ipi-singapore-innovation-marketplace",
  "iterative-demo-day",
  "kaust-entrepreneurial-spinouts",
  "kaust-innovation-ventures",
  "kaust-scalex-portfolio",
  "kaust-taqadam",
  "hub71-startup-directory",
  "mystartup-malaysia",
  "mystartup-startup-directory",
  "national-startup-awards-india",
  "ntu-innovation",
  "ntuitive",
  "seoul-bio-hub",
  "seoul-startup-plus",
  "startup-bangladesh",
  "startup-india-showcase",
  "j-startup",
  "hkstp-company-directory",
  "birac-technology-portal",
  "dcamp-startup-directory",
  "afrilabs",
  "startgate-um6p",
  "baobab-network",
];

const UA = "AliceInnovationLibrary/0.1";

async function main(): Promise<void> {
  const out: Record<string, unknown>[] = [];
  for (const slug of SLUGS) {
    const source = loadSources().find((s) => s.id === slug);
    if (!source) {
      out.push({ slug, error: "no_yaml" });
      continue;
    }
    const adapter = getAdapter(source.adapter);
    if (!adapter) {
      out.push({ slug, enabled: source.enabled, error: "no_adapter" });
      continue;
    }
    const fetch = (url: string) => fetchText(url, { userAgent: UA, timeoutMs: 25000, maxAttempts: 1 });
    try {
      const refs = await adapter.discover({
        source,
        userAgent: UA,
        timeoutMs: 25000,
        limit: null,
        fetchText: fetch,
      });
      out.push({
        slug,
        enabled: source.enabled,
        adapter: source.adapter,
        discovered: refs.length,
        collection_url: source.collection_url,
      });
    } catch (e) {
      out.push({
        slug,
        enabled: source.enabled,
        error: e instanceof Error ? e.message.slice(0, 160) : String(e),
      });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
