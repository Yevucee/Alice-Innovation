import { loadSources } from "@alice/source-registry";
import { inferCataloguePathPatternFromCollectionUrl, inferPromotedCatalogueConfig } from "@alice/database";
import { resolve } from "node:path";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { SourceAdapter } from "./types.js";

const EXPLICIT_ASIA_ADAPTER_IDS = new Set([
  "j-startup",
  "j-startup-impact",
  "sginnovate-portfolio",
  "hub71-startup-directory",
  "accelerating-asia",
  "wavemaker-partners-portfolio",
  "wavemaker-impact-portfolio",
  "circulate-capital",
  "insignia-ventures-partners",
  "thinkzone-ventures",
  "iterative-demo-day",
  "appworks-accelerator",
  "kaust-scalex-portfolio",
  "hkust-entrepreneurship-center",
]);

/** Generic html-catalogue adapters for asia-innovation rows without a bespoke adapter. */
export function buildAsiaQueueCatalogueAdapters(skipAdapterIds: ReadonlySet<string>): SourceAdapter[] {
  const sources = loadSources(resolve(process.cwd(), "config/sources.yaml"));
  const adapters: SourceAdapter[] = [];
  for (const source of sources) {
    if (source.category !== "asia-innovation") continue;
    if (source.status === "BLOCKED") continue;
    if (EXPLICIT_ASIA_ADAPTER_IDS.has(source.adapter)) continue;
    if (skipAdapterIds.has(source.adapter)) continue;
    const listing = source.collection_url ?? source.homepage;
    if (!listing) continue;
    try {
      const config = inferPromotedCatalogueConfig(listing);
      const pathPattern = inferCataloguePathPatternFromCollectionUrl(listing);
      adapters.push(
        createHtmlCatalogueAdapter({
          id: source.adapter,
          siteOrigin: config.siteOrigin,
          pathPattern: new RegExp(pathPattern, "i"),
          excludePathPattern: /^\/(author|authors|team|staff|people|profile|member|bio|event|events|calendar|news|blog|category|tag|page)(\/|$)/i,
          resourceType: "ORGANISATION",
          evidenceBasis: "PROGRAMME_SELECTED",
        }),
      );
    } catch {
      /* skip invalid URL */
    }
  }
  return adapters;
}
