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

/** Top-level innovation category paths linked from the homepage (not nested subcategories). */
export function parseSpringwiseCategoryPaths(html: string): string[] {
  const $ = load(html);
  const paths = new Set<string>();
  $("a[href*='/category/']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const path = new URL(href, "https://springwise.com").pathname;
      const segments = path.split("/").filter(Boolean);
      if (segments[0] !== "category" || segments.length !== 2) return;
      paths.add(path.endsWith("/") ? path : `${path}/`);
    } catch {
      /* ignore bad href */
    }
  });
  return [...paths].sort();
}

export function parseSpringwiseRss(xml: string): Array<{ url: string; externalId: string; listingHtml: string }> {
  const refs: Array<{ url: string; externalId: string; listingHtml: string }> = [];
  const itemBlocks = xml.split("<item>").slice(1);
  for (const block of itemBlocks) {
    const link = block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim();
    const title = block.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/)?.[1]
      || block.match(/<title>([^<]+)<\/title>/)?.[1];
    if (!link || !title || !link.includes("springwise.com/")) continue;
    if (link.includes("/category/") || link.includes("/content/")) continue;
    const path = new URL(link).pathname;
    if (path.split("/").filter(Boolean).length < 2) continue;
    const listingHtml = `<div class="tile-post" data-id="${path}"><a href="${link}" title="${title.replace(/"/g, "&quot;")}"></a></div>`;
    refs.push({ url: link, externalId: path, listingHtml });
  }
  return refs;
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

function mergeListingRefs(
  into: Map<string, { url: string; externalId: string; listingHtml: string }>,
  refs: Array<{ url: string; externalId: string; listingHtml: string }>,
): void {
  for (const ref of refs) {
    if (!into.has(ref.url)) into.set(ref.url, ref);
  }
}

export const springwiseAdapter: SourceAdapter = {
  id: "springwise",
  fullCatalogue: false,
  async discover(ctx) {
    const merged = new Map<string, { url: string; externalId: string; listingHtml: string }>();
    const home = await ctx.fetchText(ctx.source.homepage);
    mergeListingRefs(merged, parseSpringwiseListing(home.body, ctx.source.homepage));

    const categories = parseSpringwiseCategoryPaths(home.body);
    for (const categoryPath of categories) {
      const categoryUrl = new URL(categoryPath, "https://springwise.com").toString();
      try {
        const categoryPage = await ctx.fetchText(categoryUrl);
        mergeListingRefs(merged, parseSpringwiseListing(categoryPage.body, categoryUrl));
      } catch {
        /* category fetch failed; keep other discovery paths */
      }
    }

    try {
      const feed = await ctx.fetchText("https://springwise.com/feed/");
      mergeListingRefs(merged, parseSpringwiseRss(feed.body));
    } catch {
      /* feed blocked or unavailable */
    }

    return [...merged.values()].sort((a, b) => a.url.localeCompare(b.url));
  },
  fetch: defaultFetch,
  parse: parseSpringwise,
};
