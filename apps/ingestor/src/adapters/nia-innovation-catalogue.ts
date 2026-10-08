import { load } from "cheerio";
import { buildDraft } from "./draft.js";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { DiscoveredRef, FetchedPage, SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";
import type { AdapterContext } from "./types.js";

const LISTING = "https://www.nia.or.th/advance_search/Innovation";

function parseNiaInnovation(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("h1, h2, .title, .card-title").first().text().replace(/\s+/g, " ").trim()
    || $("title").text().replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`NIA innovation page has no title: ${page.url}`);
  const summary = $("meta[name='description']").attr("content")?.trim()
    || $(".description, .card-text, p").first().text().replace(/\s+/g, " ").trim()
    || title;
  const externalId = page.url.replace(/\/$/, "").split("/").pop() || page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId,
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "TECHNOLOGY",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { nia_innovation_catalogue: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

const htmlAdapter = createHtmlCatalogueAdapter({
  id: "nia-innovation-catalogue-html-fallback",
  siteOrigin: "https://www.nia.or.th",
  pathPattern: /^\/advance_search\/detail\/[^/]+/i,
  extraListingUrls: [LISTING, "https://www.nia.or.th/service/Thai-Innovation-List"],
  resourceType: "TECHNOLOGY",
  evidenceBasis: "PROGRAMME_SELECTED",
});

export const niaInnovationCatalogueAdapter: SourceAdapter = {
  id: "nia-innovation-catalogue",
  fullCatalogue: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const refs = await htmlAdapter.discover(ctx);
    if (refs.length > 0) return refs;
    const page = await ctx.fetchText(LISTING);
    const $ = load(page.body);
    const found = new Map<string, string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!/advance_search\/detail\//i.test(href)) return;
      try {
        const url = new URL(href, LISTING).toString().replace(/\/$/, "");
        if (!url.includes("nia.or.th")) return;
        found.set(url, url.split("/").pop() ?? url);
      } catch {
        /* ignore */
      }
    });
    return [...found.entries()].map(([url, externalId]) => ({ url, externalId }));
  },
  fetch: (ref, ctx) => htmlAdapter.fetch(ref, ctx),
  parse: parseNiaInnovation,
};
