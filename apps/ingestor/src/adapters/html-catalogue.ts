import { load } from "cheerio";
import { htmlToText, type NormalisedDraft, type ResourceType } from "@alice/shared";
import { buildDraft, ogImageFromPage } from "./draft.js";
import { defaultFetch, type AdapterContext, type DiscoveredRef, type FetchedPage, type SourceAdapter } from "./types.js";

export interface WordPressRestDiscovery {
  /** e.g. https://skoll.org */
  origin: string;
  /** REST collection name, e.g. grantees or portfolios */
  postType: string;
  perPage?: number;
}

export interface HtmlCatalogueConfig {
  id: string;
  /** Resolve relative links and filter by hostname */
  siteOrigin: string;
  /** Match URL pathname (leading slash). Applied after hostname check. */
  pathPattern: RegExp;
  /** Drop paths matching this pattern after pathPattern matched */
  excludePathPattern?: RegExp;
  /** Extra listing pages to fetch in addition to collection_url */
  extraListingUrls?: string[];
  /** When set, fetch listing pages whose paths match and merge discovered refs */
  followListingPathPattern?: RegExp;
  /** Extract URLs from raw HTML (e.g. embedded in scripts) */
  htmlUrlPattern?: RegExp;
  wordpressRest?: WordPressRestDiscovery;
  /** Parse <loc> URLs from a sitemap (and optional sitemap index child maps). */
  sitemap?: {
    url: string;
    /** When set, pathname must match this in addition to pathPattern */
    locPathPattern?: RegExp;
    /** Follow child sitemap URLs from a sitemap index (e.g. Yoast page-sitemap.xml). */
    followSitemapIndex?: boolean;
  };
  /** Cap listing-page follow-up fetches (pagination / year indexes). */
  maxListingPages?: number;
  resourceType: ResourceType;
  evidenceBasis: string;
  titleSuffixStrip?: RegExp;
}

function hostnameMatches(origin: string, url: URL): boolean {
  const expected = new URL(origin).hostname.replace(/^www\./, "");
  const actual = url.hostname.replace(/^www\./, "");
  return actual === expected || actual.endsWith(`.${expected}`) || expected.endsWith(`.${actual}`);
}

function slugFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? pathname;
}

export function parseHtmlCatalogueListing(
  html: string,
  pageUrl: string,
  config: HtmlCatalogueConfig,
): Array<{ url: string; externalId: string }> {
  const refs = new Map<string, string>();
  const base = pageUrl;

  const consider = (rawUrl: string) => {
    try {
      const url = new URL(rawUrl, base);
      if (!hostnameMatches(config.siteOrigin, url)) return;
      const path = url.pathname;
      if (!config.pathPattern.test(path)) return;
      if (config.excludePathPattern?.test(path)) return;
      url.hash = "";
      url.search = "";
      const canonical = url.toString().replace(/\/$/, "");
      refs.set(canonical, slugFromPath(path));
    } catch {
      /* ignore bad URLs */
    }
  };

  const $ = load(html);
  $("a[href]").each((_, element) => {
    consider($(element).attr("href") ?? "");
  });

  if (config.htmlUrlPattern) {
    for (const match of html.matchAll(config.htmlUrlPattern)) {
      const candidate = match[0] ?? match[1];
      if (candidate) consider(candidate);
    }
  }

  return [...refs.entries()].map(([url, externalId]) => ({ url, externalId }));
}

export function parseHtmlCataloguePage(page: FetchedPage, config: HtmlCatalogueConfig): NormalisedDraft {
  const $ = load(page.html);
  let title = $("meta[property='og:title']").attr("content")?.trim()
    || $("title").text().trim();
  if (config.titleSuffixStrip) {
    title = title.replace(config.titleSuffixStrip, "").trim();
  }
  if (!title) throw new Error(`${config.id} page has no title: ${page.url}`);

  const summary = $("meta[property='og:description']").attr("content")?.replace(/&#xA0;/g, " ").trim()
    || $("meta[name='description']").attr("content")?.trim()
    || title;
  const mainText = htmlToText($("main, article, .entry-content, .content").first().html() ?? "").slice(0, 4000);
  const externalId = slugFromPath(new URL(page.finalUrl || page.url).pathname);

  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId,
    summary,
    text: mainText || summary,
    resourceType: config.resourceType,
    evidenceBasis: config.evidenceBasis,
    evidenceStage: "UNKNOWN",
    imageUrl: ogImageFromPage(page.html, page.finalUrl || page.url),
    rawMetadata: { listing_only: page.listingOnly },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverWordPressRest(
  ctx: AdapterContext,
  config: WordPressRestDiscovery,
): Promise<DiscoveredRef[]> {
  const perPage = config.perPage ?? 100;
  const refs: DiscoveredRef[] = [];
  let page = 1;
  while (true) {
    const url = `${config.origin.replace(/\/$/, "")}/wp-json/wp/v2/${config.postType}?per_page=${perPage}&page=${page}`;
    const result = await ctx.fetchText(url);
    let items: Array<{ link?: string; slug?: string; id?: number }>;
    try {
      items = JSON.parse(result.body) as Array<{ link?: string; slug?: string; id?: number }>;
    } catch {
      break;
    }
    if (!Array.isArray(items) || items.length === 0) break;
    for (const item of items) {
      if (!item.link) continue;
      const canonical = item.link.replace(/\/$/, "");
      refs.push({
        url: canonical,
        externalId: item.slug ?? String(item.id ?? canonical),
      });
    }
    if (items.length < perPage) break;
    page += 1;
    if (ctx.limit !== null && refs.length >= ctx.limit) break;
  }
  return refs;
}

async function discoverFromSitemap(ctx: AdapterContext, config: HtmlCatalogueConfig): Promise<DiscoveredRef[]> {
  const spec = config.sitemap!;
  const refs = new Map<string, string>();
  const sitemapQueue = [spec.url];
  const seenSitemaps = new Set<string>();

  while (sitemapQueue.length > 0) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    const page = await ctx.fetchText(sitemapUrl);
    const body = page.body;
    if (spec.followSitemapIndex && body.includes("<sitemapindex")) {
      for (const match of body.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
        const child = match[1]?.trim();
        if (child && !seenSitemaps.has(child)) sitemapQueue.push(child);
      }
      continue;
    }

    for (const match of body.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
      const loc = match[1]?.trim();
      if (!loc) continue;
      try {
        const url = new URL(loc);
        if (!hostnameMatches(config.siteOrigin, url)) continue;
        if (!config.pathPattern.test(url.pathname)) continue;
        if (config.excludePathPattern?.test(url.pathname)) continue;
        if (spec.locPathPattern && !spec.locPathPattern.test(url.pathname)) continue;
        url.hash = "";
        url.search = "";
        const canonical = url.toString().replace(/\/$/, "");
        refs.set(canonical, slugFromPath(url.pathname));
      } catch {
        /* ignore */
      }
    }
  }

  return [...refs.entries()].map(([url, externalId]) => ({ url, externalId }));
}

async function discoverFromHtml(ctx: AdapterContext, config: HtmlCatalogueConfig): Promise<DiscoveredRef[]> {
  const listingUrls = new Set<string>();
  const collection = ctx.source.collection_url;
  if (collection) listingUrls.add(collection);
  for (const extra of config.extraListingUrls ?? []) listingUrls.add(extra);

  const refs = new Map<string, string>();
  const queue = [...listingUrls];
  const visited = new Set<string>();
  const maxListingPages = config.maxListingPages ?? 40;

  while (queue.length > 0 && visited.size < maxListingPages) {
    const listingUrl = queue.shift()!;
    if (visited.has(listingUrl)) continue;
    visited.add(listingUrl);

    const page = await ctx.fetchText(listingUrl);
    for (const ref of parseHtmlCatalogueListing(page.body, page.finalUrl || listingUrl, config)) {
      refs.set(ref.url, ref.externalId);
    }
    if (config.followListingPathPattern) {
      const $ = load(page.body);
      $("a[href]").each((_, element) => {
        const href = $(element).attr("href") ?? "";
        try {
          const path = new URL(href, listingUrl).pathname;
          if (config.followListingPathPattern!.test(path)) {
            const follow = new URL(path, config.siteOrigin).toString().replace(/\/$/, "");
            if (!visited.has(follow)) queue.push(follow);
          }
        } catch {
          /* ignore */
        }
      });
    }
  }

  return [...refs.entries()].map(([url, externalId]) => ({ url, externalId }));
}

export function createHtmlCatalogueAdapter(config: HtmlCatalogueConfig): SourceAdapter {
  return {
    id: config.id,
    fullCatalogue: Boolean(config.wordpressRest || config.sitemap),
    async discover(ctx) {
      if (config.wordpressRest) {
        return discoverWordPressRest(ctx, config.wordpressRest);
      }
      const refs = new Map<string, string>();
      for (const ref of await discoverFromHtml(ctx, config)) {
        refs.set(ref.url, ref.externalId ?? ref.url);
      }
      if (config.sitemap) {
        for (const ref of await discoverFromSitemap(ctx, config)) {
          refs.set(ref.url, ref.externalId ?? ref.url);
        }
      }
      return [...refs.entries()].map(([url, externalId]) => ({ url, externalId }));
    },
    fetch: defaultFetch,
    parse: (page) => parseHtmlCataloguePage(page, config),
  };
}
