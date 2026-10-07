import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";

const CORDIS_SEARCH = "https://cordis.europa.eu/api/search/results";

interface CordisHit {
  id?: string;
  title?: string;
  teaser?: string;
  relatedProjectReference?: string;
  relatedProjectAcronym?: string;
  contentType?: string;
}

interface CordisSearchPayload {
  status?: boolean;
  payload?: {
    total?: number;
    page?: number;
    nItems?: number;
    results?: CordisHit[];
  };
}

export interface CordisAdapterConfig {
  id: string;
  /** CORDIS search query, e.g. contenttype='project' */
  query: string;
  pageSize: number;
  /** Max pages when discover limit is null (safety cap). */
  maxPagesDefault: number;
}

function cordisPublicUrl(hit: CordisHit): string {
  const ref = hit.relatedProjectReference?.trim();
  if (ref) return `https://cordis.europa.eu/project/id/${ref}`;
  const slug = hit.id?.trim();
  if (slug) return `https://cordis.europa.eu/article/${slug}`;
  throw new Error("CORDIS hit has no public URL");
}

export function parseCordisRecord(page: FetchedPage): NormalisedDraft {
  let hit: CordisHit;
  try {
    hit = JSON.parse(page.html) as CordisHit;
  } catch {
    throw new Error(`CORDIS record is not JSON: ${page.url}`);
  }
  const title = hit.title?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`CORDIS record has no title: ${page.url}`);
  const summary = hit.teaser?.replace(/\s+/g, " ").trim() || title;
  const externalId = hit.relatedProjectReference?.trim() || hit.id?.trim() || page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId,
    summary,
    text: summary,
    resourceType: "PROJECT",
    organisationName: hit.relatedProjectAcronym?.trim() || null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { cordis: true, contentType: hit.contentType },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export function createCordisAdapter(config: CordisAdapterConfig): SourceAdapter {
  return {
    id: config.id,
    fullCatalogue: true,
    skipRobotsGuard: true,
    async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
      const refs: DiscoveredRef[] = [];
      const seenProjectRefs = new Set<string>();
      const pageSize = config.pageSize;
      const maxRefs = ctx.limit ?? config.maxPagesDefault * pageSize;
      const maxPages = config.maxPagesDefault;
      const timeoutMs = Math.max(ctx.timeoutMs, 45_000);

      for (let page = 1; page <= maxPages; page += 1) {
        const url = `${CORDIS_SEARCH}?query=${encodeURIComponent(config.query)}&p=${page}&num=${pageSize}`;
        const payload = await fetchJson<CordisSearchPayload>(url, {
          userAgent: ctx.userAgent,
          timeoutMs,
        });
        const hits = payload.payload?.results ?? [];
        if (hits.length === 0) break;
        for (const hit of hits) {
          try {
            const projectRef = hit.relatedProjectReference?.trim();
            const dedupeKey = projectRef || hit.id?.trim();
            if (!dedupeKey || seenProjectRefs.has(dedupeKey)) continue;
            seenProjectRefs.add(dedupeKey);
            const publicUrl = cordisPublicUrl(hit);
            refs.push({
              url: publicUrl,
              externalId: projectRef || hit.id?.trim(),
              listingHtml: JSON.stringify(hit),
            });
          } catch {
            continue;
          }
          if (refs.length >= maxRefs) break;
        }
        if (refs.length >= maxRefs) break;
      }
      return refs;
    },
    async fetch(ref: DiscoveredRef, ctx: AdapterContext): Promise<FetchedPage> {
      if (ref.listingHtml) {
        return listingPageFromJson(ref, JSON.parse(ref.listingHtml));
      }
      return listingPageFromJson(ref, {});
    },
    parse: parseCordisRecord,
  };
}
