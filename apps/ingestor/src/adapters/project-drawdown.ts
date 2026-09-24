import { load } from "cheerio";
import { htmlToText, type NormalisedDraft } from "@alice/shared";
import { buildDraft } from "./draft.js";
import { defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";

const SKIP = new Set(["primer", "faqs", "acknowledgments", "explorer"]);

export function parseDrawdown(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $(".field--name-title").first().text().replace(/\s+/g, " ").trim() || $("h1").first().text().trim();
  if (!title) throw new Error(`Drawdown page has no title: ${page.url}`);
  const summaryHtml = $(".field-summary").first().html() ?? "";
  const summary = htmlToText(summaryHtml);
  const classification = $(".classifications .name").first().text().replace(/\s+/g, " ").trim();
  const slug = page.url.split("/").filter(Boolean).pop() ?? page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId: slug,
    summary: summary || $("meta[property='og:description']").attr("content") || title,
    text: summary,
    resourceType: "SOLUTION",
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    tags: classification ? [classification] : [],
    rawMetadata: { classification: classification || null, listing_only: page.listingOnly },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const projectDrawdownAdapter: SourceAdapter = {
  id: "project-drawdown",
  fullCatalogue: true,
  async discover(ctx) {
    const collection = ctx.source.collection_url ?? "https://drawdown.org/explorer";
    const page = await ctx.fetchText(collection);
    const $ = load(page.body);
    const urls = new Set<string>();
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href") ?? "";
      const match = href.match(/^\/explorer\/([a-z0-9-]+)\/?$/);
      if (!match || SKIP.has(match[1])) return;
      urls.add(new URL(href, "https://drawdown.org").toString());
    });
    return [...urls].sort().map((url) => ({ url, externalId: url.split("/").pop() }));
  },
  fetch: defaultFetch,
  parse: parseDrawdown,
};
