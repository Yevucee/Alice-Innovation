import { load } from "cheerio";
import { htmlToText, type NormalisedDraft, type ResourceType } from "@alice/shared";
import { buildDraft } from "./draft.js";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import { defaultFetch, type AdapterContext, type DiscoveredRef, type FetchedPage, type SourceAdapter } from "./types.js";

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Parse cohort/finalist blocks from a single article or challenge page. */
function createCohortPageAdapter(config: {
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
      const refs: DiscoveredRef[] = [];
      $("h2, h3, h4, li, p").each((_, element) => {
        const text = $(element).text().replace(/\s+/g, " ").trim();
        if (text.length < 12 || text.length > 220) return;
        if (!/[A-Za-z]{3,}/.test(text)) return;
        const slug = slugify(text.slice(0, 80));
        if (slug.length < 4) return;
        refs.push({
          url: `${collection.replace(/\/$/, "")}#${slug}`,
          externalId: `${config.id}-${slug}`,
          listingHtml: `<div class="cohort-item">${$(element).html() ?? text}</div>`,
        });
      });
      const unique = new Map<string, DiscoveredRef>();
      for (const ref of refs) unique.set(ref.externalId!, ref);
      return [...unique.values()].slice(0, ctx.limit ?? 500);
    },
    async fetch(ref) {
      return {
        url: ref.url,
        finalUrl: ref.url,
        status: 200,
        html: ref.listingHtml ?? "",
        etag: null,
        lastModified: null,
        listingOnly: true,
      };
    },
    parse(page: FetchedPage): NormalisedDraft {
      const $ = load(page.html);
      const title = $(".cohort-item").text().trim().slice(0, 200);
      if (!title) throw new Error(`${config.id} cohort item has no title: ${page.url}`);
      return buildDraft({
        title,
        url: page.url,
        externalId: slugify(title),
        summary: title,
        text: title,
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
    const title = load(page.html)("title").text().trim() || page.url;
    return buildDraft({
      title,
      url: page.finalUrl || page.url,
      externalId: slugify(page.url),
      summary: title,
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
    id: "kosmos-innovation-centre-ghana",
    programme: "Kosmos Innovation Center Ghana",
    resourceType: "SOLUTION",
    year: 2025,
  }),
  createCohortPageAdapter({
    id: "africa-tech-summit-showcase",
    programme: "Africa Tech Summit Investment Showcase",
    resourceType: "ORGANISATION",
  }),
  createCohortPageAdapter({
    id: "mest-africa-challenge",
    programme: "MEST Africa Challenge",
    resourceType: "ORGANISATION",
    year: 2025,
  }),
  createCohortPageAdapter({
    id: "milken-motsepe-innovation-prize",
    programme: "Milken-Motsepe Innovation Prize",
    resourceType: "SOLUTION",
  }),
  createCohortPageAdapter({
    id: "global-startup-awards-africa",
    programme: "Global Startup Awards Africa",
    resourceType: "ORGANISATION",
  }),
  createCohortPageAdapter({
    id: "flat6labs-africa",
    programme: "Flat6Labs Africa",
    resourceType: "ORGANISATION",
  }),
  createCohortPageAdapter({
    id: "growthafrica",
    programme: "GrowthAfrica",
    resourceType: "ORGANISATION",
  }),
  createCohortPageAdapter({
    id: "africarena",
    programme: "AfricArena",
    resourceType: "ORGANISATION",
  }),
  createCohortPageAdapter({
    id: "africa-fintech-summit-alpha-expo",
    programme: "Africa Fintech Summit Alpha Expo",
    resourceType: "ORGANISATION",
  }),
];
