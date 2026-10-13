import { load, type CheerioAPI } from "cheerio";
import { htmlToText } from "@alice/shared";
import { buildDraft } from "./draft.js";
import {
  assertDiscoverNonEmpty,
  assertSouthAmericaDescription,
  assertSouthAmericaTitle,
  contentFingerprint,
  dedupeDiscoveredRefs,
  enrichSouthAmericaPortfolioDescription,
  isListingExcerptDescription,
  isPremiosSouthAmericaCountry,
  isSouthAmericaCountryLabel,
  parseSouthAmericaCountryFromLocation,
  premiosIncludeCentralAmerica,
  stripFapespTitlePrefix,
  stripPersonalContactHtml,
} from "./south-america-quality.js";
import { listingPageFromJson } from "./open-data/http-json.js";
import { defaultFetch, type AdapterContext, type DiscoveredRef, type FetchedPage, type SourceAdapter } from "./types.js";

const FAPESP_ORIGIN = "https://bv.fapesp.br";
const UC_ORIGIN = "https://transferenciaydesarrollo.uc.cl";
const PREMIOS_ORIGIN = "https://500-mejores.premiosverdes.org";
const GRIDX_ORIGIN = "https://www.gridexponential.com";
const GRIDX_PORTFOLIO_URL = `${GRIDX_ORIGIN}/portfolio`;
const UNC_ORIGIN = "https://ofertatecnologica.secyt.unc.edu.ar";
const UNC_LIST_PATH = "/capacidades-tecnologicas";

const FAPESP_AUXILIO_PATH_RE = /\/pt\/auxilios\/(\d+)\/([^/?#]+)\/?/gi;
const FAPESP_AUXILIO_URL_RE = /\/pt\/auxilios\/(\d+)\/([^/?#]+)\/?/i;
const PREMIOS_EDITION_YEAR = 2026;

function absoluteUrl(origin: string, href: string): string {
  return new URL(href, origin).toString();
}

function discoverFingerprintDedupe(refs: DiscoveredRef[]): DiscoveredRef[] {
  const seen = new Set<string>();
  const out: DiscoveredRef[] = [];
  for (const ref of refs) {
    const key = ref.externalId ?? ref.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export function extractFapespAuxilioRefs(html: string, origin = FAPESP_ORIGIN): DiscoveredRef[] {
  const refs: DiscoveredRef[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(FAPESP_AUXILIO_PATH_RE)) {
    const id = match[1];
    const slug = match[2];
    const path = `/pt/auxilios/${id}/${slug}/`;
    if (seen.has(id)) continue;
    seen.add(id);
    refs.push({
      url: absoluteUrl(origin, path),
      externalId: id,
    });
  }
  return refs;
}

async function discoverFapespPipe(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  let refs = extractFapespAuxilioRefs(page.body);

  refs = dedupeDiscoveredRefs(discoverFingerprintDedupe(refs));
  if (ctx.limit !== null) refs = refs.slice(0, ctx.limit);
  assertDiscoverNonEmpty(ctx.source.id, refs);
  return refs;
}

export function parseFapespPipeDetail(page: FetchedPage) {
  const $ = load(page.html);
  const idMatch = page.url.match(FAPESP_AUXILIO_URL_RE);
  const externalId = idMatch?.[1] ?? "";
  if (!externalId) throw new Error(`fapesp-pipe: missing auxilio id in URL ${page.url}`);

  let title = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) {
    title = $("title").text().replace(/\s+/g, " ").trim();
  }
  title = stripFapespTitlePrefix(title);
  title = title.replace(/,?\s*AP\.PIPE\s*$/i, "").trim();
  assertSouthAmericaTitle(title);

  const resumoHtml = $("#resumo").first().html() ?? "";
  const description = htmlToText(resumoHtml || $("#resumo").text()).replace(/\s+/g, " ").trim();
  assertSouthAmericaDescription(description, "detail");

  return buildDraft({
    title,
    url: page.url,
    externalId,
    summary: description,
    text: description,
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "IN_DEVELOPMENT",
    countryName: "Brazil",
    continentName: "South America",
    language: "pt",
    rawMetadata: {
      programme: "FAPESP PIPE Fase 1",
      fapesp_auxilio_id: externalId,
      content_fingerprint: contentFingerprint(title, description),
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

function parseUcListingCard($: CheerioAPI, card: Parameters<CheerioAPI>[0]): DiscoveredRef | null {
  const $card = $(card);
  const link = $card.find("a[href*='/innovaciones-uc/tecnologias/']").filter((_idx, el) => {
    const href = $(el).attr("href") ?? "";
    return /\/tecnologias\/[^/]+\/?$/i.test(href) && !href.endsWith("/tecnologias/");
  }).first();
  const href = link.attr("href");
  if (!href) return null;
  const url = absoluteUrl(UC_ORIGIN, href);
  const slug = url.split("/").filter(Boolean).pop() ?? href;
  const title = $card.find("h2, h3, .card-title, .titulo").first().text().replace(/\s+/g, " ").trim()
    || link.text().replace(/\s+/g, " ").trim();
  if (!title) return null;
  return { url, externalId: slug, listingHtml: $.html($card) };
}

async function discoverUcChile(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const refs: DiscoveredRef[] = [];
  const seenPages = new Set<string>();
  let nextUrl: string | null = collection;

  while (nextUrl && !seenPages.has(nextUrl)) {
    seenPages.add(nextUrl);
    const page = await ctx.fetchText(nextUrl);
    const $ = load(page.body);
    const cards = $(".tecnologia-card, .card-tecnologia, article.tecnologia, .grid-item, .uc-tech-card");
    if (cards.length === 0) {
      $("a[href*='/innovaciones-uc/tecnologias/']").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        if (!/\/tecnologias\/[^/]+\/?$/i.test(href) || href.endsWith("/tecnologias/")) return;
        const url = absoluteUrl(UC_ORIGIN, href);
        const slug = url.split("/").filter(Boolean).pop() ?? url;
        refs.push({ url, externalId: slug });
      });
    } else {
      cards.each((_, el) => {
        const ref = parseUcListingCard($, $(el));
        if (ref) refs.push(ref);
      });
    }

    const nextLink = $("a.next.page-numbers, .pagination a.next, a[rel='next']").attr("href")
      ?? $("a").filter((_, el) => /siguiente|próxima|next/i.test($(el).text())).first().attr("href");
    nextUrl = nextLink ? absoluteUrl(UC_ORIGIN, nextLink) : null;
    if (ctx.limit !== null && refs.length >= ctx.limit) break;
    if (seenPages.size > 12) break;
  }

  let deduped = dedupeDiscoveredRefs(discoverFingerprintDedupe(refs));
  if (ctx.limit !== null) deduped = deduped.slice(0, ctx.limit);
  assertDiscoverNonEmpty(ctx.source.id, deduped);
  return deduped;
}

export function parseUcChileDetail(page: FetchedPage) {
  const $ = load(page.html);
  const slug = page.url.split("/").filter(Boolean).pop() ?? page.url;
  let title = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) title = $("meta[property='og:title']").attr("content")?.trim() ?? "";
  assertSouthAmericaTitle(title);

  const descriptionBlock = $(".descripcion, .description, .entry-content, .contenido, article").first();
  let description = htmlToText(descriptionBlock.html() ?? descriptionBlock.text()).replace(/\s+/g, " ").trim();
  if (isListingExcerptDescription(description)) {
    assertSouthAmericaDescription("", "listing");
  }
  assertSouthAmericaDescription(description, "detail");

  const englishPath = page.url.replace("/innovaciones-uc/", "/en/innovaciones-uc/");
  if (page.finalUrl.includes("/en/")) {
    throw new Error("uc-chile-technologies: English duplicate page skipped");
  }

  return buildDraft({
    title,
    url: page.url,
    externalId: slug,
    summary: description,
    text: description,
    resourceType: "TECHNOLOGY",
    evidenceBasis: "PROGRAMME_SELECTED",
    countryName: "Chile",
    continentName: "South America",
    language: "es",
    rawMetadata: {
      content_fingerprint: contentFingerprint(title, description),
      skip_english_url: englishPath,
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export function parsePremiosVerdesListingCard(html: string, origin = PREMIOS_ORIGIN): Array<{
  title: string;
  organisation: string;
  locationLine: string;
  category: string;
  detailUrl: string;
  stableId: string;
}> {
  const $ = load(html);
  const cards: Array<{
    title: string;
    organisation: string;
    locationLine: string;
    category: string;
    detailUrl: string;
    stableId: string;
  }> = [];

  const cardSelector = ".pv-project-card, .project-card, [data-project-id], article.project";
  $(cardSelector).each((_, el) => {
    const card = $(el);
    const title = card.find("h2, h3, .project-title").first().text().replace(/\s+/g, " ").trim();
    const organisation = card.find(".organisation, .organizacion, .org-name").first().text().replace(/\s+/g, " ").trim();
    const locationLine = card.find(".location, .ubicacion, .country-city").first().text().replace(/\s+/g, " ").trim();
    const category = card.find(".category, .categoria").first().text().replace(/\s+/g, " ").trim();
    const detailHref = card.find("a").filter((__, a) => /conocer|más|mas|ver/i.test($(a).text())).first().attr("href")
      ?? card.find("a[href*='proyecto']").first().attr("href")
      ?? card.find("a[href]").first().attr("href");
    if (!title || !detailHref) return;
    const detailUrl = absoluteUrl(origin, detailHref);
    const slug = detailUrl.split("/").filter(Boolean).pop() ?? title;
    const stableId = `${PREMIOS_EDITION_YEAR}-${slug}`;
    cards.push({ title, organisation, locationLine, category, detailUrl, stableId });
  });

  return cards;
}

async function discoverPremiosVerdes(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const collection = ctx.source.collection_url;
  if (!collection) return [];
  const page = await ctx.fetchText(collection);
  const includeCentral = premiosIncludeCentralAmerica(ctx.source.discovery.notes);
  const cards = parsePremiosVerdesListingCard(page.body);
  const refs: DiscoveredRef[] = [];

  for (const card of cards) {
    const countryName = parseSouthAmericaCountryFromLocation(card.locationLine);
    if (!includeCentral && !isPremiosSouthAmericaCountry(countryName)) continue;
    refs.push({
      url: card.detailUrl,
      externalId: card.stableId,
      listingHtml: `<div data-sa-card="1" data-title="${card.title}" data-org="${card.organisation}" data-location="${card.locationLine}" data-category="${card.category}"></div>`,
    });
  }

  let deduped = dedupeDiscoveredRefs(discoverFingerprintDedupe(refs));
  if (ctx.limit !== null) deduped = deduped.slice(0, ctx.limit);
  assertDiscoverNonEmpty(ctx.source.id, deduped);
  return deduped;
}

export function parsePremiosVerdesDetail(page: FetchedPage) {
  const $ = load(page.html);
  const idMatch = page.url.match(/\/([^/]+)\/?$/);
  const slug = idMatch?.[1] ?? page.url;
  const externalId = `${PREMIOS_EDITION_YEAR}-${slug}`;

  let title = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) title = $("[data-title]").attr("data-title")?.trim() ?? "";
  assertSouthAmericaTitle(title);

  const sanitised = stripPersonalContactHtml(page.html);
  const $sanitised = load(sanitised);
  const description = htmlToText(
    $sanitised(".project-description, .descripcion, .description, main article, main").first().html()
      ?? $sanitised("main").text(),
  ).replace(/\s+/g, " ").trim();
  assertSouthAmericaDescription(description, "detail");

  const org = $("[data-org]").attr("data-org")
    ?? $(".organisation, .organizacion").first().text().replace(/\s+/g, " ").trim()
    ?? null;
  const locationLine = $("[data-location]").attr("data-location")
    ?? $(".location, .ubicacion").first().text().replace(/\s+/g, " ").trim();
  const countryName = parseSouthAmericaCountryFromLocation(locationLine);
  const category = $("[data-category]").attr("data-category")
    ?? $(".category, .categoria").first().text().replace(/\s+/g, " ").trim();

  return buildDraft({
    title,
    url: page.url,
    externalId,
    summary: description,
    text: description,
    organisationName: org,
    countryName,
    continentName: countryName ? "South America" : null,
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
    language: "es",
    tags: category ? [category] : [],
    rawMetadata: {
      edition_year: PREMIOS_EDITION_YEAR,
      premios_category: category || null,
      location_line: locationLine || null,
      content_fingerprint: contentFingerprint(title, description),
      south_america_only: !premiosIncludeCentralAmerica(""),
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const fapespPipeAdapter: SourceAdapter = {
  id: "fapesp-pipe",
  fullCatalogue: true,
  discover: discoverFapespPipe,
  fetch: defaultFetch,
  parse: parseFapespPipeDetail,
};

export const ucChileTechnologiesAdapter: SourceAdapter = {
  id: "uc-chile-technologies",
  fullCatalogue: true,
  discover: discoverUcChile,
  fetch: defaultFetch,
  parse: parseUcChileDetail,
};

export const premiosVerdes500Adapter: SourceAdapter = {
  id: "premios-verdes-500",
  fullCatalogue: true,
  discover: discoverPremiosVerdes,
  fetch: defaultFetch,
  parse: parsePremiosVerdesDetail,
};

export interface GridxPortfolioCard {
  title: string;
  countryName: string | null;
  description: string;
  website: string;
  stableId: string;
}

export function parseGridxPortfolioCards(html: string): GridxPortfolioCard[] {
  const chunks = html.split("transform:rotateY(180deg)");
  const cards: GridxPortfolioCard[] = [];
  const seenWebsites = new Set<string>();

  for (const chunk of chunks.slice(1)) {
    const countryName = chunk.match(/title="([^"]+)"/)?.[1]?.trim() ?? null;
    const title = chunk.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const description = chunk.match(/<p class="text-sm[^"]*">([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? "";
    const website = chunk.match(/href="([^"]+)"[^>]*>Visit Website/)?.[1]?.trim() ?? "";
    if (!title || !website || !description) continue;
    const websiteKey = website.toLowerCase();
    if (seenWebsites.has(websiteKey)) continue;
    seenWebsites.add(websiteKey);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    cards.push({
      title,
      countryName,
      description,
      website,
      stableId: slug || websiteKey,
    });
  }
  return cards;
}

async function discoverGridxPortfolio(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const page = await ctx.fetchText(GRIDX_PORTFOLIO_URL);
  const includeCentral = premiosIncludeCentralAmerica(ctx.source.discovery.notes);
  const refs: DiscoveredRef[] = [];

  for (const card of parseGridxPortfolioCards(page.body)) {
    if (!card.countryName) continue;
    const southAmerica = isSouthAmericaCountryLabel(card.countryName)
      || (includeCentral && /mexico|costa rica/i.test(card.countryName));
    if (!southAmerica) continue;
    refs.push({
      url: card.website,
      externalId: card.stableId,
      listingHtml: JSON.stringify(card),
      listingExtras: { catalogue_url: GRIDX_PORTFOLIO_URL },
    });
  }

  let deduped = dedupeDiscoveredRefs(discoverFingerprintDedupe(refs));
  if (ctx.limit !== null) deduped = deduped.slice(0, ctx.limit);
  assertDiscoverNonEmpty(ctx.source.id, deduped);
  return deduped;
}

export function parseGridxPortfolioDetail(page: FetchedPage) {
  let card: GridxPortfolioCard;
  try {
    card = JSON.parse(page.html) as GridxPortfolioCard;
  } catch {
    throw new Error("gridx-portfolio: expected listing JSON payload");
  }
  assertSouthAmericaTitle(card.title);
  const description = enrichSouthAmericaPortfolioDescription(card.description, {
    countryName: card.countryName,
    catalogueLabel: "GRIDX venture portfolio",
  });
  assertSouthAmericaDescription(description, "detail");

  return buildDraft({
    title: card.title,
    url: card.website,
    externalId: card.stableId,
    summary: description,
    text: description,
    countryName: card.countryName,
    continentName: "South America",
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
    language: "en",
    rawMetadata: {
      gridx_country_label: card.countryName,
      portfolio_website: card.website,
      content_fingerprint: contentFingerprint(card.title, description),
      listing_only: true,
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

const gridxPortfolioAdapter: SourceAdapter = {
  id: "gridx-portfolio",
  fullCatalogue: true,
  async discover(ctx) {
    return discoverGridxPortfolio(ctx);
  },
  async fetch(ref, ctx) {
    if (ref.listingHtml) {
      return listingPageFromJson(ref, JSON.parse(ref.listingHtml));
    }
    return defaultFetch(ref, ctx);
  },
  parse: parseGridxPortfolioDetail,
};

export function extractUncNodeRefs(html: string, origin = UNC_ORIGIN): DiscoveredRef[] {
  const $ = load(html);
  const refs: DiscoveredRef[] = [];
  const seen = new Set<string>();
  $("a[href^='/node/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/^\/node\/(\d+)$/);
    if (!match) return;
    const nodeId = match[1];
    if (seen.has(nodeId)) return;
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!title || /^leer más$/i.test(title)) return;
    seen.add(nodeId);
    refs.push({
      url: absoluteUrl(origin, `/node/${nodeId}`),
      externalId: nodeId,
    });
  });
  return refs;
}

async function discoverUncOferta(ctx: AdapterContext): Promise<DiscoveredRef[]> {
  const refs: DiscoveredRef[] = [];
  const seenIds = new Set<string>();
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const listUrl = absoluteUrl(UNC_ORIGIN, `${UNC_LIST_PATH}?page=${pageIndex}`);
    const page = await ctx.fetchText(listUrl);
    for (const ref of extractUncNodeRefs(page.body)) {
      if (seenIds.has(ref.externalId ?? ref.url)) continue;
      seenIds.add(ref.externalId ?? ref.url);
      refs.push(ref);
    }
    const $ = load(page.body);
    const hasNext = $("a[rel='next'], .pager a[title*='siguiente']").length > 0;
    if (!hasNext && pageIndex > 0) break;
  }
  let deduped = dedupeDiscoveredRefs(discoverFingerprintDedupe(refs));
  if (ctx.limit !== null) deduped = deduped.slice(0, ctx.limit);
  assertDiscoverNonEmpty(ctx.source.id, deduped);
  return deduped;
}

export function parseUncOfertaDetail(page: FetchedPage) {
  const $ = load(page.html);
  const nodeId = page.url.match(/\/node\/(\d+)/)?.[1] ?? page.url;
  let title = $("h1.page-header, h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) title = $("title").text().replace(/\s+\|.*$/, "").trim();
  assertSouthAmericaTitle(title);

  let description = "";
  $(".field--name-body").each((_, el) => {
    const field = $(el);
    const label = field.find("> .field--label").first().text().replace(/\s+/g, " ").trim();
    if (label && !/descripción/i.test(label)) return;
    const itemHtml = field.find("> .field--item").first().html() ?? field.find(".field--item").first().html();
    const text = htmlToText(itemHtml ?? field.text()).replace(/\s+/g, " ").trim();
    if (text.length > description.length) description = text;
  });
  if (!description) {
    description = htmlToText($("article .field--name-body, .node__content .field--item").last().html() ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const enriched = enrichSouthAmericaPortfolioDescription(description, {
    countryName: "Argentina",
    catalogueLabel: "UNC Oferta Tecnológica",
  });
  assertSouthAmericaDescription(enriched, "detail");

  return buildDraft({
    title,
    url: page.url,
    externalId: nodeId,
    summary: enriched,
    text: enriched,
    countryName: "Argentina",
    continentName: "South America",
    resourceType: "TECHNOLOGY",
    evidenceBasis: "PROGRAMME_SELECTED",
    language: "es",
    rawMetadata: {
      unc_node_id: nodeId,
      content_fingerprint: contentFingerprint(title, enriched),
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

const uncOfertaTecnologicaAdapter: SourceAdapter = {
  id: "unc-oferta-tecnologica",
  fullCatalogue: true,
  discover: discoverUncOferta,
  fetch: defaultFetch,
  parse: parseUncOfertaDetail,
};

export const southAmericaAdapters: SourceAdapter[] = [
  fapespPipeAdapter,
  ucChileTechnologiesAdapter,
  premiosVerdes500Adapter,
  gridxPortfolioAdapter,
  uncOfertaTecnologicaAdapter,
];
