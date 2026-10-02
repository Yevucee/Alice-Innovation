import { load } from "cheerio";
import { htmlToText, type NormalisedDraft, type ResourceType } from "@alice/shared";
import { buildDraft } from "./draft.js";
import {
  isBoilerplateCatalogueTitle,
  resolveCatalogueTitle,
} from "./catalogue-parse-helpers.js";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import { defaultFetch, type AdapterContext, type DiscoveredRef, type FetchedPage, type SourceAdapter } from "./types.js";

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function listingItemUrl(collection: string, slug: string): string {
  const url = new URL(collection);
  url.searchParams.set("item", slug);
  return url.toString();
}

function listingFetch(ref: DiscoveredRef): Promise<FetchedPage> {
  if (!ref.listingHtml) throw new Error("listingHtml missing on ref");
  return Promise.resolve({
    url: ref.url,
    finalUrl: ref.url,
    status: 200,
    html: ref.listingHtml,
    etag: null,
    lastModified: null,
    listingOnly: true,
  });
}

/** Structured cohort cards (Webflow/CMS blocks), not raw h2/li/p page noise. */
export function createCohortPageAdapter(config: {
  id: string;
  resourceType: ResourceType;
  programme: string;
  year?: number;
}): SourceAdapter {
  return {
    id: config.id,
    fullCatalogue: true,
    async discover(ctx) {
      const collection = ctx.source.collection_url;
      if (!collection) return [];
      const page = await ctx.fetchText(collection);
      const $ = load(page.body);
      const refs = new Map<string, DiscoveredRef>();

      const push = (title: string, html: string, externalKey?: string) => {
        if (isBoilerplateCatalogueTitle(title)) return;
        const slug = slugify(title.slice(0, 80));
        if (slug.length < 4) return;
        const externalId = externalKey ?? `${config.id}-${slug}`;
        refs.set(externalId, {
          url: listingItemUrl(collection, slug),
          externalId,
          listingHtml: `<div class="cohort-item" data-programme="${config.programme}">${html}</div>`,
        });
      };

      $(".w-dyn-item, .portfolio-item, .cohort-item, article").each((_, element) => {
        const block = $(element);
        const title = block.find("[fs-list-field='name'], [fs-list-field='Name'], h2, h3, h4, strong").first().text().replace(/\s+/g, " ").trim()
          || block.find("a[href]").first().text().replace(/\s+/g, " ").trim();
        if (!title) return;
        push(title, block.html() ?? title);
      });

      $("table tbody tr").each((_, row) => {
        const cells = $(row).find("td, th");
        const title = cells.first().text().replace(/\s+/g, " ").trim();
        const detail = cells.eq(1).text().replace(/\s+/g, " ").trim();
        if (!title || title.length > 120) return;
        if (detail.length < 8 && title.length < 8) return;
        push(title, `<p>${detail || title}</p>`);
      });

      return [...refs.values()].slice(0, ctx.limit ?? 500);
    },
    fetch: listingFetch,
    parse(page: FetchedPage): NormalisedDraft {
      const $ = load(page.html);
      const block = $(".cohort-item").first();
      const title = block.find("[fs-list-field='name'], [fs-list-field='Name'], h2, h3, h4, strong").first().text().replace(/\s+/g, " ").trim()
        || block.text().split("\n").map((line) => line.trim()).find((line) => line.length > 2)
        || "";
      const cleaned = title.replace(/\s+/g, " ").trim().slice(0, 200);
      if (!cleaned || isBoilerplateCatalogueTitle(cleaned)) {
        throw new Error(`${config.id} cohort item has no title: ${page.url}`);
      }
      const body = htmlToText(block.html() ?? cleaned).slice(0, 4000);
      const summary = body.length >= 40 ? body.slice(0, 500) : cleaned;
      return buildDraft({
        title: cleaned,
        url: page.url,
        externalId: slugify(cleaned),
        summary,
        text: body || summary,
        resourceType: config.resourceType,
        evidenceBasis: "PROGRAMME_SELECTED",
        evidenceStage: "UNKNOWN",
        rawMetadata: {
          listing_only: true,
          programme: config.programme,
          year: config.year ?? null,
          cohort_source: true,
        },
        etag: page.etag,
        lastModified: page.lastModified,
      });
    },
  };
}

async function discoverLaunchLab(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const refs = new Map<string, DiscoveredRef>();
  for (const match of page.body.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
    const src = match[1];
    if (!src || src.startsWith("javascript:")) continue;
    try {
      const url = new URL(src, collection).toString();
      if (!/portfolio|startup|venture|launchlab|notion|airtable|spreadsheet/i.test(url)) continue;
      refs.set(url, { url, externalId: slugify(url) });
    } catch {
      /* ignore */
    }
  }
  return [...refs.values()];
}

const launchLabAdapter: SourceAdapter = {
  id: "su-launchlab",
  fullCatalogue: false,
  discover: discoverLaunchLab,
  fetch: defaultFetch,
  parse(page) {
    const $ = load(page.html);
    const title = resolveCatalogueTitle($, page.html) || $("h1").first().text().trim();
    if (!title || isBoilerplateCatalogueTitle(title)) {
      throw new Error(`su-launchlab iframe page has no title: ${page.url}`);
    }
    const summary = $("meta[property='og:description']").attr("content")?.trim()
      || htmlToText($("main, article, p").first().html() ?? "").slice(0, 500)
      || title;
    return buildDraft({
      title,
      url: page.finalUrl || page.url,
      externalId: slugify(page.url),
      summary,
      text: htmlToText(page.html).slice(0, 2000),
      resourceType: "ORGANISATION",
      evidenceBasis: "PROGRAMME_SELECTED",
      evidenceStage: "UNKNOWN",
      rawMetadata: { iframe_catalogue: true },
      etag: page.etag,
      lastModified: page.lastModified,
    });
  },
};

export const africaSecondPassAdapters: SourceAdapter[] = [
  launchLabAdapter,
  createHtmlCatalogueAdapter({
    id: "kenya-climate-innovation-centre",
    siteOrigin: "https://kenyacic.org",
    pathPattern: /^\/(venture|ventures|portfolio|our-ventures)\/[^/]+\/?$/i,
    sitemap: { url: "https://kenyacic.org/sitemap.xml", followSitemapIndex: true },
    resourceType: "SOLUTION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createCohortPageAdapter({
    id: "global-startup-awards-africa",
    programme: "Global Startup Awards Africa",
    resourceType: "ORGANISATION",
  }),
];
