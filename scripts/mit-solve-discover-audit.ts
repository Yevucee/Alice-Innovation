/**
 * Random MIT Solve discover URLs + HTTP status / title probe.
 */
import { loadDotEnv } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import { load } from "cheerio";

loadDotEnv();

const SAMPLE = 10;

async function main(): Promise<void> {
  const source = loadSources().find((s) => s.id === "mit-solve");
  if (!source) throw new Error("mit-solve missing");
  const adapter = getAdapter("mit-solve");
  if (!adapter) throw new Error("adapter missing");
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1";
  const timeoutMs = 45_000;
  const ctx = {
    source,
    userAgent,
    timeoutMs,
    limit: null as number | null,
    fetchText: (url: string) => fetchText(url, { userAgent, timeoutMs }),
  };
  const refs = await adapter.discover(ctx);
  const pick = [...refs].sort(() => Math.random() - 0.5).slice(0, SAMPLE);
  console.log(`# MIT Solve discover audit\n\ndiscover_total=${refs.length}\n`);
  console.log("## 10 random discovered URLs\n");
  for (const ref of pick) {
    let status = "?";
    let title = "?";
    let kind = "unknown";
    try {
      const page = await fetchText(ref.url, { userAgent, timeoutMs });
      status = String(page.status);
      const $ = load(page.body);
      const h1 = $("h1.heading-2").first().text().replace(/\s+/g, " ").trim();
      const notFound = $("title").text().includes("Page Not Found");
      title = h1 || $("title").text().trim();
      kind = notFound ? "404 page" : h1 ? "solution profile (h1.heading-2)" : "other HTML";
    } catch (e) {
      title = e instanceof Error ? e.message : String(e);
    }
    console.log(`- ${ref.url} | HTTP ${status} | ${kind} | **${title.slice(0, 80)}**`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
