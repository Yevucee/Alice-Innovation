import { load } from "cheerio";
import { absoluteImageUrl, buildDraft, ogImageFromPage } from "./draft.js";
import { defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

export function parseSpringwise(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  if (page.listingOnly || $(".tile-post").length > 0 && !$("article h1, h1.entry-title").length) {
    const link = $(".tile-post a[title]").first();
    const title = link.attr("title")?.trim() || "";
    const href = link.attr("href") || page.url;
    const externalId = $(".tile-post").attr("data-id") || href;
    if (!title) throw new Error(`Springwise listing has no title: ${page.url}`);
    const tileImg = $(".tile-post img").first().attr("src") || $(".tile-post img").first().attr("data-src");
    const imageUrl = absoluteImageUrl(page.url, tileImg) || ogImageFromPage(page.html, page.url);
    return buildDraft({
      title,
      url: href,
      externalId,
      summary: title,
      text: "",
      resourceType: "SOLUTION",
      imageUrl,
      evidenceBasis: "EDITORIALLY_CURATED",
      rawMetadata: { listing_only: true },
      etag: page.etag,
      lastModified: page.lastModified,
    });
  }
  const title = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`Springwise page has no title: ${page.url}`);
  const summary = $("meta[property='og:description']").attr("content")
    || $("p.excerpt").first().text()
    || "";
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId: page.url,
    summary,
    text: summary,
    resourceType: "SOLUTION",
    imageUrl: ogImageFromPage(page.html, page.finalUrl || page.url),
    evidenceBasis: "EDITORIALLY_CURATED",
    rawMetadata: { listing_only: false },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export function parseSpringwiseListing(html: string, pageUrl: string): Array<{ url: string; externalId: string; listingHtml: string }> {
  const $ = load(html);
  const refs: Array<{ url: string; externalId: string; listingHtml: string }> = [];
  $(".tile-post").each((_, element) => {
    const tile = $(element);
    const link = tile.find("a[href]").first();
    const href = link.attr("href");
    if (!href || !href.includes("springwise.com/") || href.includes("/category/") || href.includes("/content/")) return;
    const path = new URL(href, "https://springwise.com").pathname;
    if (path.split("/").filter(Boolean).length < 2) return;
    refs.push({
      url: new URL(href, "https://springwise.com").toString(),
      externalId: tile.attr("data-id") || path,
      listingHtml: $.html(element),
    });
  });
  if (refs.length === 0 && pageUrl) return refs;
  return refs;
}

export const springwiseAdapter: SourceAdapter = {
  id: "springwise",
  fullCatalogue: false,
  async discover(ctx) {
    const home = await ctx.fetchText(ctx.source.homepage);
    return parseSpringwiseListing(home.body, ctx.source.homepage);
  },
  fetch: defaultFetch,
  parse: parseSpringwise,
};
