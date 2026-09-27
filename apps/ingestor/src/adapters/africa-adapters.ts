import { load } from "cheerio";
import { htmlToText, type NormalisedDraft } from "@alice/shared";
import { buildDraft } from "./draft.js";
import { createHtmlCatalogueAdapter, parseHtmlCataloguePage } from "./html-catalogue.js";
import { defaultFetch, type AdapterContext, type DiscoveredRef, type FetchedPage, type SourceAdapter } from "./types.js";

const AFRICA_REGION_RE = /\b(?:sub-?saharan\s+africa|africa|african)\b/i;

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

function createListingCardAdapter(config: {
  id: string;
  fullCatalogue: boolean;
  discover: (ctx: AdapterContext) => Promise<DiscoveredRef[]>;
  parse: (page: FetchedPage) => NormalisedDraft;
}): SourceAdapter {
  return {
    id: config.id,
    fullCatalogue: config.fullCatalogue,
    discover: config.discover,
    fetch: listingFetch,
    parse: config.parse,
  };
}

export function parseBaobabCard(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $(".portfolio-card__company-name").first().text().trim();
  const summary = $(".portfolio-card__company-text").first().text().trim();
  if (!title) throw new Error(`baobab-network card has no title: ${page.url}`);
  const externalId = slugify(title);
  return buildDraft({
    title,
    url: page.url,
    externalId,
    summary: summary || title,
    text: summary,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { listing_only: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverBaobab(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const $ = load(page.body);
  const refs: DiscoveredRef[] = [];
  $(".portfolio-rollup__card, .companies-table__row").each((_, element) => {
    const card = $(element);
    const title = card.find(".portfolio-card__company-name, .companies-table__name").first().text().trim();
    if (!title) return;
    const slug = slugify(title);
    refs.push({
      url: `${collection.replace(/\/$/, "")}#${slug}`,
      externalId: slug,
      listingHtml: $.html(element),
    });
  });
  return refs;
}

export function parseCchubSyndicateCard(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("h2").first().text().trim();
  const summary = $("p").first().text().trim();
  if (!title) throw new Error(`cchub-syndicate card has no title: ${page.url}`);
  const externalId = slugify(title);
  const website = $("a[href^='http']").first().attr("href") ?? null;
  return buildDraft({
    title,
    url: page.url,
    externalId,
    summary: summary || title,
    text: summary,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { listing_only: true, website },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverCchubSyndicate(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const $ = load(page.body);
  const refs: DiscoveredRef[] = [];
  $(".card").each((_, element) => {
    const card = $(element);
    const title = card.find("h2").first().text().trim();
    if (!title) return;
    const slug = slugify(title);
    refs.push({
      url: `${collection.replace(/\.html$/, "")}#${slug}`,
      externalId: slug,
      listingHtml: $.html(element),
    });
  });
  return refs;
}

export function parseNorrskenAccordionItem(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("[fs-list-field='name']").first().text().trim();
  const problem = $("[fs-list-field='problem']").first().text().trim();
  const solution = $("[fs-list-field='solution']").first().text().trim();
  const year = $("[fs-list-field='year']").first().text().trim();
  const labels = $("[fs-list-field='sector']").map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const country = labels.find((label) => !/tech|fintech|health|green|climate|proptech|transport|saas|ai\b/i.test(label)) ?? null;
  const sector = labels.find((label) => label !== country) ?? null;
  if (!title) throw new Error(`norrsken item has no title: ${page.url}`);
  const summary = solution || problem || title;
  const text = [problem && `Problem: ${problem}`, solution && `Solution: ${solution}`].filter(Boolean).join("\n\n");
  return buildDraft({
    title,
    url: page.url,
    externalId: slugify(title),
    summary,
    text: text || summary,
    resourceType: "SOLUTION",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { listing_only: true, country, sector, year },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverNorrskenAccordion(ctx: AdapterContext, baseUrl: string): Promise<DiscoveredRef[]> {
  const page = await ctx.fetchText(baseUrl);
  const $ = load(page.body);
  const refs: DiscoveredRef[] = [];
  $(".faq-list.w-dyn-item, .w-dyn-item.faq-list").each((_, element) => {
    const item = $(element);
    const title = item.find("[fs-list-field='name']").first().text().trim();
    if (!title) return;
    const slug = slugify(title);
    refs.push({
      url: `${baseUrl.replace(/\/$/, "")}#${slug}`,
      externalId: slug,
      listingHtml: $.html(element),
    });
  });
  return refs;
}

export function parseNorrsken100Item(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("h2, h3, h4").first().text().trim();
  const summary = $("p").first().text().trim() || title;
  if (!title) throw new Error(`norrsken-100 item has no title: ${page.url}`);
  return buildDraft({
    title,
    url: page.url,
    externalId: slugify(title),
    summary,
    text: summary,
    resourceType: "SOLUTION",
    evidenceBasis: "EDITORIALLY_CURATED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { listing_only: true, catalogue: "norrsken-100" },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverNorrsken100(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const $ = load(page.body);
  const refs: DiscoveredRef[] = [];
  const skip = new Set(["NORRSKEN/100", "The list", "Welcome"]);
  $("h2, h3").each((_, element) => {
    const title = $(element).text().trim();
    if (!title || skip.has(title) || title.length < 2) return;
    const slug = slugify(title);
    const parent = $(element).closest('[role="listitem"], .w-dyn-item').first();
    const fragment = parent.length ? parent : $(element);
    refs.push({
      url: `${collection.replace(/\/$/, "")}#${slug}`,
      externalId: slug,
      listingHtml: $.html(fragment),
    });
  });
  return refs;
}

export function parseSeedstarsAfricaCard(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("img[alt]").first().attr("alt")?.trim()
    || $("a").first().text().trim();
  const region = $(".area-category").first().text().trim();
  if (!title) throw new Error(`seedstars-africa card has no title: ${page.url}`);
  return buildDraft({
    title,
    url: $("a[href]").first().attr("href") || page.url,
    externalId: slugify(title),
    summary: region ? `${region} — ${title}` : title,
    text: region,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { listing_only: true, region },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function discoverSeedstarsAfrica(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const $ = load(page.body);
  const refs: DiscoveredRef[] = [];
  $(".carousel-card-outer").each((_, element) => {
    const card = $(element);
    const region = card.find(".area-category").first().text().trim();
    if (!region || !AFRICA_REGION_RE.test(region)) return;
    const title = card.find("img[alt]").first().attr("alt")?.trim();
    if (!title) return;
    const slug = slugify(title);
    refs.push({
      url: `${collection.replace(/\/$/, "")}#${slug}`,
      externalId: slug,
      listingHtml: $.html(card),
    });
  });
  return refs;
}

async function discoverAfricaTechFestival(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const $ = load(page.body);
  const refs = new Map<string, DiscoveredRef>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    if (!href.includes("exhibitor-")) return;
    try {
      const url = new URL(href, collection).toString().replace(/\/$/, "");
      const slug = slugify(new URL(url).pathname.split("/").pop() ?? url);
      refs.set(url, { url, externalId: slug });
    } catch {
      /* ignore */
    }
  });
  return [...refs.values()];
}

const htmlAfricaCatalogues: SourceAdapter[] = [
  createHtmlCatalogueAdapter({
    id: "startgate-um6p",
    siteOrigin: "https://www.startgate.ma",
    pathPattern: /^\/startups\/[^/]+\/?$/i,
    excludePathPattern: /^\/startups\/page-/i,
    paginationQueryParam: { param: "page", startPage: 1, maxPages: 160 },
    maxListingPages: 200,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    titleSuffixStrip: /\s*\|\s*StartGate.*$/i,
  }),
  createHtmlCatalogueAdapter({
    id: "digital-africa",
    siteOrigin: "https://digital-africa.co",
    pathPattern: /^\/(en\/)?portfolio\/[^/]+\/?$/i,
    excludePathPattern: /^\/(en\/)?portfolio\/?$/i,
    sitemap: { url: "https://digital-africa.co/sitemap.xml" },
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "ghana-climate-innovation-centre",
    siteOrigin: "https://ghanacic.ashesi.edu.gh",
    pathPattern: /^\/ventures\/[^/]+\/?$/i,
    resourceType: "SOLUTION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "ventures-platform",
    siteOrigin: "https://www.venturesplatform.com",
    pathPattern: /^\/portfolio-companies\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "founders-factory-africa",
    siteOrigin: "https://www.foundersfactory.africa",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    excludePathPattern: /^\/portfolio\/?$/i,
    sitemap: { url: "https://www.foundersfactory.africa/sitemap.xml" },
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "ihub-future-of-learning",
    siteOrigin: "https://futureoflearning.ihub.co.ke",
    pathPattern: /^\/startup-directory\/[^/]+\/?$/i,
    excludePathPattern: /^\/startup-directory\/(page\/\d+\/)?$/i,
    followListingPathPattern: /^\/startup-directory\/page\/\d+\/?$/i,
    maxListingPages: 30,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "oceanhub-africa",
    siteOrigin: "https://oceanhub.africa",
    pathPattern: /^\/[^/]+\/?$/i,
    excludePathPattern: /^\/(category|wp-content|wp-json|feed|about|our-work|we-support|we-connect|we-invest|we-consult|contact|career-opportunities|deal-book)(\/|$)/i,
    wordpressRest: { origin: "https://oceanhub.africa", postType: "posts", categories: 152, perPage: 100 },
    resourceType: "SOLUTION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
];

const gitexSupernovaAdapter: SourceAdapter = {
  id: "gitex-africa-supernova",
  fullCatalogue: true,
  async discover(ctx) {
    const collection = ctx.source.collection_url;
    if (!collection) return [];
    const page = await ctx.fetchText(collection);
    const $ = load(page.body);
    const refs: DiscoveredRef[] = [];
    $("h2, h3, h4").each((_, element) => {
      const heading = $(element).text().trim();
      if (!heading || heading.length < 3) return;
      const block = $(element).parent();
      const text = htmlToText(block.html() ?? "").slice(0, 2000);
      if (!/winner|finalist|semifinalist/i.test(text) && !/sector|country/i.test(text)) return;
      const slug = slugify(heading);
      refs.push({
        url: `${collection.replace(/\/$/, "")}#${slug}`,
        externalId: `gitex-2026-${slug}`,
        listingHtml: $.html(block),
      });
    });
    return refs;
  },
  fetch: listingFetch,
  parse(page) {
    const $ = load(page.html);
    const title = $("h2, h3, h4").first().text().trim();
    const text = htmlToText(page.html).slice(0, 4000);
    if (!title) throw new Error(`gitex-africa-supernova block has no title: ${page.url}`);
    return buildDraft({
      title,
      url: page.url,
      externalId: slugify(title),
      summary: text.slice(0, 500) || title,
      text,
      resourceType: "ORGANISATION",
      evidenceBasis: "PROGRAMME_SELECTED",
      evidenceStage: "UNKNOWN",
      rawMetadata: { listing_only: true, programme: "GITEX Africa Supernova", year: 2026 },
      etag: page.etag,
      lastModified: page.lastModified,
    });
  },
};

const injiniAdapter: SourceAdapter = {
  id: "injini-african-edtech-map",
  fullCatalogue: false,
  async discover(ctx) {
    const collection = ctx.source.collection_url;
    if (!collection) return [];
    const page = await ctx.fetchText(collection);
    if (!page.body.includes("fs-list-element")) {
      return [];
    }
    const $ = load(page.body);
    const refs: DiscoveredRef[] = [];
    $("[fs-list-field='Product-Name'], [fs-list-field='name']").each((_, element) => {
      const title = $(element).text().trim();
      if (!title || title === "unknown") return;
      const slug = slugify(title);
      refs.push({
        url: `${collection.replace(/\/$/, "")}#${slug}`,
        externalId: slug,
        listingHtml: $.html($(element).closest('[role="listitem"], .w-dyn-item').first()),
      });
    });
    return refs;
  },
  fetch: listingFetch,
  parse(page) {
    const $ = load(page.html);
    const title = $("[fs-list-field='Product-Name'], [fs-list-field='name'], h1").first().text().trim();
    const summary = $("[fs-list-field='Country'], #modal-data-description").first().text().trim() || title;
    if (!title) throw new Error(`injini-african-edtech-map item has no title: ${page.url}`);
    return buildDraft({
      title,
      url: page.url,
      externalId: slugify(title),
      summary,
      text: summary,
      resourceType: "SOLUTION",
      evidenceBasis: "EDITORIALLY_CURATED",
      evidenceStage: "UNKNOWN",
      rawMetadata: { listing_only: true },
      etag: page.etag,
      lastModified: page.lastModified,
    });
  },
};

const startupbootcampAfritechAdapter: SourceAdapter = {
  id: "startupbootcamp-afritech",
  fullCatalogue: false,
  async discover(ctx) {
    const collection = ctx.source.collection_url;
    if (!collection) return [];
    const page = await ctx.fetchText(collection);
    const refs = new Map<string, DiscoveredRef>();
    for (const match of page.body.matchAll(/href="(\/startup\/[a-f0-9-]+)"/gi)) {
      const path = match[1];
      const url = new URL(path, collection).toString().replace(/\/$/, "");
      refs.set(url, { url, externalId: path.split("/").pop() ?? url });
    }
    return [...refs.values()];
  },
  fetch: defaultFetch,
  parse(page) {
    return parseHtmlCataloguePage(page, {
      id: "startupbootcamp-afritech",
      siteOrigin: "https://sbcafritech.com",
      pathPattern: /^\/startup\/[^/]+\/?$/i,
      resourceType: "ORGANISATION",
      evidenceBasis: "PROGRAMME_SELECTED",
    });
  },
};

const africaTechFestivalAdapter: SourceAdapter = {
  id: "africa-tech-festival-startup-hub",
  fullCatalogue: false,
  discover: discoverAfricaTechFestival,
  fetch: defaultFetch,
  parse(page) {
    const $ = load(page.html);
    const title = $("h1").first().text().trim() || $("title").text().trim();
    const summary = $("meta[name='description']").attr("content")?.trim()
      || $("p").first().text().trim()
      || title;
    if (!title) throw new Error(`africa-tech-festival profile has no title: ${page.url}`);
    return buildDraft({
      title,
      url: page.finalUrl || page.url,
      externalId: slugify(new URL(page.finalUrl || page.url).pathname),
      summary,
      text: htmlToText($("main, article, .content").first().html() ?? "").slice(0, 4000) || summary,
      resourceType: "ORGANISATION",
      evidenceBasis: "PROGRAMME_SELECTED",
      evidenceStage: "UNKNOWN",
      rawMetadata: { partial_catalogue: true, exhibitor_profile: true },
      etag: page.etag,
      lastModified: page.lastModified,
    });
  },
};

export const africaAdapters: SourceAdapter[] = [
  ...htmlAfricaCatalogues,
  createListingCardAdapter({
    id: "baobab-network",
    fullCatalogue: true,
    discover: discoverBaobab,
    parse: parseBaobabCard,
  }),
  createListingCardAdapter({
    id: "cchub-syndicate",
    fullCatalogue: true,
    discover: discoverCchubSyndicate,
    parse: parseCchubSyndicateCard,
  }),
  createListingCardAdapter({
    id: "norrsken-accelerator",
    fullCatalogue: true,
    discover: (ctx) => discoverNorrskenAccordion(ctx, "https://accelerator.norrsken.org/portfolio"),
    parse: parseNorrskenAccordionItem,
  }),
  createListingCardAdapter({
    id: "norrsken-100",
    fullCatalogue: true,
    discover: discoverNorrsken100,
    parse: parseNorrsken100Item,
  }),
  createListingCardAdapter({
    id: "seedstars-africa",
    fullCatalogue: false,
    discover: discoverSeedstarsAfrica,
    parse: parseSeedstarsAfricaCard,
  }),
  gitexSupernovaAdapter,
  injiniAdapter,
  startupbootcampAfritechAdapter,
  africaTechFestivalAdapter,
];
