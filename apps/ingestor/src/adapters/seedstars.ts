import { load } from "cheerio";
import { parsePortfolioRegionLabel } from "@alice/taxonomy";
import { buildDraft } from "./draft.js";
import {
  defaultFetch,
  type AdapterContext,
  type DiscoveredRef,
  type FetchedPage,
  type SourceAdapter,
} from "./types.js";

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

export function parseSeedstarsCard(page: FetchedPage) {
  const $ = load(page.html);
  const title = $("img[alt]").first().attr("alt")?.trim()
    || $("a").first().text().trim();
  const regionLabel = $(".area-category").first().text().trim();
  if (!title) throw new Error(`seedstars card has no title: ${page.url}`);
  const geo = parsePortfolioRegionLabel(regionLabel || "Global");
  const summaryParts = [geo.locationLabel, geo.sectorHint, title].filter(Boolean);
  return buildDraft({
    title,
    url: $("a[href]").first().attr("href") || page.url,
    externalId: slugify(title),
    summary: summaryParts.join(" · "),
    text: regionLabel,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    countryName: geo.countryName ?? geo.locationLabel,
    continentName: geo.continent,
    rawMetadata: {
      listing_only: true,
      region_label: geo.rawRegion,
      continent: geo.continent,
      sector_hint: geo.sectorHint,
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverSeedstars(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const $ = load(page.body);
  const refs: DiscoveredRef[] = [];
  $(".carousel-card-outer").each((_, element) => {
    const card = $(element);
    const region = card.find(".area-category").first().text().trim();
    const title = card.find("img[alt]").first().attr("alt")?.trim();
    if (!title) return;
    const slug = slugify(title);
    refs.push({
      url: listingItemUrl(collection, slug),
      externalId: slug,
      listingHtml: $.html(card),
    });
  });
  return refs;
}

export const seedstarsAdapter: SourceAdapter = {
  id: "seedstars",
  fullCatalogue: true,
  discover: discoverSeedstars,
  fetch: listingFetch,
  parse: parseSeedstarsCard,
};
