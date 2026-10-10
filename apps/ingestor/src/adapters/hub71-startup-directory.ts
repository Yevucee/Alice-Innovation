import { htmlToText } from "@alice/shared";
import { load } from "cheerio";
import { resolveHub71PublicUrl } from "../hub71-url.js";
import { buildDraft } from "./draft.js";
import { listingPageFromJson } from "./open-data/http-json.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

const LISTING_API = "https://www.hub71.com/all-startups";

interface Hub71StartupRow {
  id: number;
  slug?: { en?: string };
  title?: { en?: string };
  description?: { en?: string };
  sector?: string;
  website?: string;
}

interface Hub71ListingResponse {
  data: Hub71StartupRow[];
  last_page?: number;
}

function startupDetailUrl(slug: string): string {
  return `https://www.hub71.com/startups/${slug}`;
}

function pickEn(field: { en?: string } | string | undefined): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.en ?? "";
}

export const hub71StartupDirectoryAdapter: SourceAdapter = {
  id: "hub71-startup-directory",
  fullCatalogue: true,
  skipRobotsGuard: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const refs: DiscoveredRef[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const url = `${LISTING_API}?page=${page}&perPage=${perPage}`;
      const result = await ctx.fetchText(url);
      let payload: Hub71ListingResponse;
      try {
        payload = JSON.parse(result.body) as Hub71ListingResponse;
      } catch {
        break;
      }
      const rows = payload.data ?? [];
      if (rows.length === 0) break;
      for (const row of rows) {
        const slug = pickEn(row.slug);
        if (!slug) continue;
        const detailUrl = startupDetailUrl(slug);
        const publicUrl = resolveHub71PublicUrl(row.website, detailUrl);
        refs.push({
          url: detailUrl,
          externalId: slug,
          listingHtml: JSON.stringify({
            slug,
            title: pickEn(row.title),
            description: pickEn(row.description),
            sector: row.sector,
          }),
        });
      }
      if (ctx.limit !== null && refs.length >= ctx.limit) break;
      const lastPage = payload.last_page ?? page;
      if (page >= lastPage) break;
      page += 1;
    }
    return ctx.limit !== null ? refs.slice(0, ctx.limit) : refs;
  },
  async fetch(ref: DiscoveredRef, ctx: AdapterContext): Promise<FetchedPage> {
    if (ref.listingHtml) {
      return listingPageFromJson(ref, JSON.parse(ref.listingHtml));
    }
    const result = await ctx.fetchText(ref.url);
    return {
      url: ref.url,
      finalUrl: result.finalUrl,
      status: result.status,
      html: result.body,
      etag: result.etag,
      lastModified: result.lastModified,
      listingOnly: false,
    };
  },
  parse(page: FetchedPage): NormalisedDraft {
    let payload: {
      slug?: string;
      title?: string;
      description?: string;
      website?: string;
      sector?: string;
      detailUrl?: string;
    };
    try {
      payload = JSON.parse(page.html) as typeof payload;
    } catch {
      payload = {};
    }
    if (payload.title) {
      const summary = (payload.description ?? payload.title).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const url = resolveHub71PublicUrl(payload.website, payload.detailUrl || page.url);
      return buildDraft({
        title: payload.title,
        url,
        externalId: payload.slug ?? url,
        summary: summary.slice(0, 500),
        text: summary,
        resourceType: "ORGANISATION",
        organisationName: payload.title,
        evidenceBasis: "PROGRAMME_SELECTED",
        evidenceStage: "UNKNOWN",
        rawMetadata: { hub71_startup_directory: true, sector: payload.sector, hub71_detail_url: payload.detailUrl },
        etag: page.etag,
        lastModified: page.lastModified,
      });
    }
    const $ = load(page.html);
    const title = $("h1").first().text().replace(/\s+/g, " ").trim()
      || $("meta[property='og:title']").attr("content")?.trim()
      || $("title").text().replace(/\s+/g, " ").trim();
    if (!title) throw new Error(`hub71 startup page has no title: ${page.url}`);
    const summary = $("meta[property='og:description']").attr("content")?.trim()
      || $("meta[name='description']").attr("content")?.trim()
      || title;
    const mainText = htmlToText($("main").html() ?? "").slice(0, 4000);
    const pathname = new URL(page.finalUrl || page.url).pathname;
    const externalId = pathname.split("/").filter(Boolean).pop() ?? pathname;
    return buildDraft({
      title,
      url: page.finalUrl || page.url,
      externalId,
      summary: summary.slice(0, 500),
      text: mainText || summary,
      resourceType: "ORGANISATION",
      evidenceBasis: "PROGRAMME_SELECTED",
      evidenceStage: "UNKNOWN",
      rawMetadata: { hub71_startup_directory: true },
      etag: page.etag,
      lastModified: page.lastModified,
    });
  },
};
