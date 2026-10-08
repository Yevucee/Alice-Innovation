import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";

/** Community mirror of YC company metadata (https://github.com/yc-oss/api). */
const YC_COMPANIES_ALL = "https://yc-oss.github.io/api/companies/all.json";

interface YcCompany {
  id?: number;
  name?: string;
  slug?: string;
  website?: string;
  one_liner?: string;
  long_description?: string;
  all_locations?: string;
  industry?: string;
  batch?: string;
}

export function parseYcOssCompany(page: FetchedPage): NormalisedDraft {
  let hit: YcCompany;
  try {
    hit = JSON.parse(page.html) as YcCompany;
  } catch {
    throw new Error(`YC OSS record is not JSON: ${page.url}`);
  }
  const title = hit.name?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`YC company has no name: ${page.url}`);
  const summary = (hit.one_liner || hit.long_description || title).replace(/\s+/g, " ").trim();
  const slug = hit.slug?.trim() || String(hit.id ?? title);
  const url = hit.website?.trim() || `https://www.ycombinator.com/companies/${slug}`;
  return buildDraft({
    title,
    url,
    externalId: slug,
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "ORGANISATION",
    organisationName: title,
    countryName: hit.all_locations?.split(",").pop()?.trim() || null,
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: {
      ycombinator_oss: true,
      batch: hit.batch,
      industry: hit.industry,
      yc_profile: `https://www.ycombinator.com/companies/${slug}`,
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const ycombinatorOssCompaniesAdapter: SourceAdapter = {
  id: "ycombinator-oss-companies",
  fullCatalogue: true,
  skipRobotsGuard: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const companies = await fetchJson<YcCompany[]>(YC_COMPANIES_ALL, {
      userAgent: ctx.userAgent,
      timeoutMs: Math.max(ctx.timeoutMs, 60_000),
    });
    const refs: DiscoveredRef[] = [];
    for (const company of companies) {
      const slug = company.slug?.trim();
      if (!slug) continue;
      const profile = `https://www.ycombinator.com/companies/${slug}`;
      refs.push({
        url: company.website?.trim() || profile,
        externalId: slug,
        listingHtml: JSON.stringify(company),
      });
      if (ctx.limit !== null && refs.length >= ctx.limit) break;
    }
    return refs;
  },
  async fetch(ref: DiscoveredRef): Promise<FetchedPage> {
    const hit = ref.listingHtml ? JSON.parse(ref.listingHtml) : {};
    return listingPageFromJson(ref, hit);
  },
  parse: parseYcOssCompany,
};
