import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";

const NSF_AWARDS = "https://api.nsf.gov/services/v1/awards.json";

interface NsfAward {
  id?: string;
  title?: string;
  awardeeName?: string;
  abstractText?: string;
}

interface NsfResponse {
  response?: { award?: NsfAward[] };
}

export function parseNsfAward(page: FetchedPage): NormalisedDraft {
  let hit: NsfAward;
  try {
    hit = JSON.parse(page.html) as NsfAward;
  } catch {
    throw new Error(`NSF award is not JSON: ${page.url}`);
  }
  const title = hit.title?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`NSF award has no title: ${page.url}`);
  const summary = hit.abstractText?.replace(/\s+/g, " ").trim().slice(0, 2000) || title;
  const id = hit.id?.trim();
  if (!id) throw new Error(`NSF award has no id: ${page.url}`);
  const url = `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${id}`;
  return buildDraft({
    title,
    url,
    externalId: id,
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "RESEARCH",
    organisationName: hit.awardeeName?.trim() || null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { nsf_award: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const nsfAwardsAdapter: SourceAdapter = {
  id: "nsf-awards-catalogue",
  fullCatalogue: true,
  skipRobotsGuard: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const refs: DiscoveredRef[] = [];
    const pageSize = 25;
    const maxPagesDefault = 80;
    const maxRefs = ctx.limit ?? maxPagesDefault * pageSize;
    const maxPages = maxPagesDefault;
    const timeoutMs = Math.max(ctx.timeoutMs, 45_000);

    for (let page = 1; page <= maxPages; page += 1) {
      const offset = (page - 1) * pageSize + 1;
      const url = `${NSF_AWARDS}?printFields=id,title,awardeeName,abstractText&offset=${offset}&rpp=${pageSize}`;
      const payload = await fetchJson<NsfResponse>(url, { userAgent: ctx.userAgent, timeoutMs });
      const awards = payload.response?.award ?? [];
      if (awards.length === 0) break;
      for (const award of awards) {
        if (!award.id || !award.title) continue;
        const publicUrl = `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${award.id}`;
        refs.push({
          url: publicUrl,
          externalId: award.id,
          listingHtml: JSON.stringify(award),
        });
        if (refs.length >= maxRefs) break;
      }
      if (refs.length >= maxRefs) break;
    }
    return refs;
  },
  async fetch(ref: DiscoveredRef): Promise<FetchedPage> {
    return listingPageFromJson(ref, ref.listingHtml ? JSON.parse(ref.listingHtml) : {});
  },
  parse: parseNsfAward,
};
