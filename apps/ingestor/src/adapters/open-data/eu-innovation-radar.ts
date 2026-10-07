import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";

const INNO_RADAR_API = "https://innovation-radar.ec.europa.eu/innoradar-api/v1/innovations";

interface InnoRadarHit {
  id?: string;
  title?: string;
  description?: string;
  organisation?: string;
  market?: string;
}

interface InnoRadarPage {
  content?: InnoRadarHit[];
  totalElements?: number;
  last?: boolean;
}

export function parseEuInnovationRadar(page: FetchedPage): NormalisedDraft {
  let hit: InnoRadarHit;
  try {
    hit = JSON.parse(page.html) as InnoRadarHit;
  } catch {
    throw new Error(`Innovation Radar record is not JSON: ${page.url}`);
  }
  const title = hit.title?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`Innovation Radar hit has no title: ${page.url}`);
  const summary = hit.description?.replace(/\s+/g, " ").trim().slice(0, 2000) || title;
  const id = hit.id?.trim();
  if (!id) throw new Error(`Innovation Radar hit has no id: ${page.url}`);
  const url = `https://innovation-radar.ec.europa.eu/innovation/${id}`;
  return buildDraft({
    title,
    url,
    externalId: id,
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "TECHNOLOGY",
    organisationName: hit.organisation?.trim() || null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { eu_innovation_radar: true, market: hit.market },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const euInnovationRadarAdapter: SourceAdapter = {
  id: "eu-innovation-radar",
  fullCatalogue: true,
  skipRobotsGuard: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const refs: DiscoveredRef[] = [];
    const pageSize = 50;
    const maxPagesDefault = 40;
    const maxRefs = ctx.limit ?? maxPagesDefault * pageSize;
    const maxPages = maxPagesDefault;
    const timeoutMs = Math.max(ctx.timeoutMs, 45_000);

    for (let page = 0; page < maxPages; page += 1) {
      const url = `${INNO_RADAR_API}?size=${pageSize}&page=${page}`;
      const payload = await fetchJson<InnoRadarPage>(url, { userAgent: ctx.userAgent, timeoutMs });
      const hits = payload.content ?? [];
      if (hits.length === 0) break;
      for (const hit of hits) {
        if (!hit.id || !hit.title) continue;
        const publicUrl = `https://innovation-radar.ec.europa.eu/innovation/${hit.id}`;
        refs.push({
          url: publicUrl,
          externalId: hit.id,
          listingHtml: JSON.stringify(hit),
        });
        if (refs.length >= maxRefs) break;
      }
      if (refs.length >= maxRefs) break;
      if (payload.last) break;
    }
    return refs;
  },
  async fetch(ref: DiscoveredRef): Promise<FetchedPage> {
    return listingPageFromJson(ref, ref.listingHtml ? JSON.parse(ref.listingHtml) : {});
  },
  parse: parseEuInnovationRadar,
};
