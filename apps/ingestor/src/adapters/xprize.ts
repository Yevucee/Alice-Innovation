import { load } from "cheerio";
import { buildDraft, ogImageFromPage } from "./draft.js";
import { defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

const COMPETITION_PATH = /^\/competitions\/[a-z0-9-]+\/?$/i;

export function parseXprizeListing(html: string, baseUrl: string): Array<{ url: string; externalId: string }> {
  const $ = load(html);
  const urls = new Map<string, string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    let path = href;
    try {
      if (href.startsWith("http")) path = new URL(href).pathname;
    } catch {
      return;
    }
    if (!COMPETITION_PATH.test(path)) return;
    const slug = path.split("/").filter(Boolean).pop() ?? path;
    const url = new URL(path, baseUrl).toString().replace(/\/$/, "");
    urls.set(url, slug);
  });
  return [...urls.entries()].map(([url, externalId]) => ({ url, externalId }));
}

export function parseXprize(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("meta[property='og:title']").attr("content")
    ?.replace(/\s*\|\s*XPRIZE Foundation.*$/i, "")
    .trim()
    || $("title").text().replace(/\s*\|\s*XPRIZE Foundation.*$/i, "").trim();
  if (!title) throw new Error(`XPRIZE page has no title: ${page.url}`);
  const summary = $("meta[property='og:description']").attr("content")?.replace(/&#xA0;/g, " ").trim()
    || $("meta[name='description']").attr("content")?.trim()
    || title;
  const slug = page.url.split("/").filter(Boolean).pop() ?? page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId: slug,
    summary,
    text: summary,
    resourceType: "PROGRAMME",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    imageUrl: ogImageFromPage(page.html, page.finalUrl || page.url),
    rawMetadata: { listing_only: page.listingOnly },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const xprizeAdapter: SourceAdapter = {
  id: "xprize",
  fullCatalogue: true,
  async discover(ctx) {
    const collection = ctx.source.collection_url ?? "https://www.xprize.org/competitions";
    const page = await ctx.fetchText(collection);
    return parseXprizeListing(page.body, "https://www.xprize.org");
  },
  fetch: defaultFetch,
  parse: parseXprize,
};
