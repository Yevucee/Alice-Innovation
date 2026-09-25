import { buildDraft } from "./draft.js";
import type { DiscoveredRef, FetchedPage, SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

const API_ROOT = "https://wipogreen.wipo.int/wipogreen-database/api/v1";
const ARTICLE_WEB = "https://wipogreen.wipo.int/wipogreen-database/en/articles";

interface WipoSearchHit {
  id: number;
  title?: string;
  description?: string;
  company?: string;
}

interface WipoSearchResponse {
  result?: {
    content?: WipoSearchHit[];
    last?: boolean;
    totalPages?: number;
  };
}

async function postSearch(
  page: number,
  size: number,
  userAgent: string,
  timeoutMs: number,
): Promise<WipoSearchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_ROOT}/search`, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "",
        filters: [],
        queryFilters: [],
        type: "BASIC",
        pagination: { page, size },
        sort: [{ field: "CREATED_AT", direction: "DESC" }],
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`WIPO GREEN search HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    return JSON.parse(body) as WipoSearchResponse;
  } finally {
    clearTimeout(timer);
  }
}

export function parseWipoGreen(page: FetchedPage): NormalisedDraft {
  let payload: WipoSearchHit & { summary?: string };
  try {
    payload = JSON.parse(page.html) as WipoSearchHit & { summary?: string };
  } catch {
    throw new Error(`WIPO GREEN record is not JSON: ${page.url}`);
  }
  const title = payload.title?.trim();
  if (!title) throw new Error(`WIPO GREEN record has no title: ${page.url}`);
  const summary = payload.description?.trim() || payload.summary?.trim() || title;
  const externalId = String(payload.id);
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId,
    summary,
    text: summary,
    resourceType: "TECHNOLOGY",
    organisationName: payload.company?.trim() || null,
    evidenceBasis: "EDITORIALLY_CURATED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { api_record: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function fetchWipoRecord(ref: DiscoveredRef, ctx: { userAgent: string; timeoutMs: number }): Promise<FetchedPage> {
  if (ref.listingHtml) {
    return {
      url: ref.url,
      finalUrl: ref.url,
      status: 200,
      html: ref.listingHtml,
      etag: null,
      lastModified: null,
      listingOnly: false,
    };
  }
  const id = ref.externalId ?? ref.url.split("/").filter(Boolean).pop();
  const detailUrl = `${API_ROOT}/articles/${id}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(ctx.timeoutMs, 45_000));
  try {
    const response = await fetch(detailUrl, {
      signal: controller.signal,
      headers: { "user-agent": ctx.userAgent, accept: "application/json" },
    });
    const body = await response.text();
    if (response.ok) {
      return {
        url: ref.url,
        finalUrl: ref.url,
        status: response.status,
        html: body,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        listingOnly: false,
      };
    }
  } finally {
    clearTimeout(timer);
  }
  throw new Error(`WIPO GREEN article ${id} could not be fetched`);
}

export const wipoGreenAdapter: SourceAdapter = {
  id: "wipo-green",
  fullCatalogue: true,
  async discover(ctx) {
    const refs: DiscoveredRef[] = [];
    const pageSize = 25;
    const maxPages = ctx.limit ? Math.ceil(ctx.limit / pageSize) : 40;
    const timeoutMs = Math.max(ctx.timeoutMs, 60_000);
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await postSearch(page, pageSize, ctx.userAgent, timeoutMs);
      const content = payload.result?.content ?? [];
      if (content.length === 0) break;
      for (const hit of content) {
        if (!hit.id || !hit.title) continue;
        refs.push({
          url: `${ARTICLE_WEB}/${hit.id}`,
          externalId: String(hit.id),
          listingHtml: JSON.stringify(hit),
        });
      }
      if (payload.result?.last) break;
    }
    return refs;
  },
  fetch: fetchWipoRecord,
  parse: parseWipoGreen,
};
