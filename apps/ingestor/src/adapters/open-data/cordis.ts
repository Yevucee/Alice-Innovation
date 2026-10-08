import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";
import { cordisHitLooksInnovationRelevant } from "./innovation-filter.js";

const PHASE2_DISCOVER_CAP = 500;

/** Website search API (Lucene `q=`); the legacy `/api/search/results` endpoint ignores filters. */
const CORDIS_SEARCH_EN = "https://cordis.europa.eu/search/en";

export interface CordisProjectRecord {
  id?: string;
  rcn?: string;
  acronym?: string;
  title?: string;
  teaser?: string;
  objective?: string;
  contenttype?: string;
}

interface CordisSearchEnHit {
  project?: CordisProjectRecord;
}

interface CordisSearchEnResponse {
  hits?: { hit?: CordisSearchEnHit | CordisSearchEnHit[] };
}

export interface CordisAdapterConfig {
  id: string;
  /** CORDIS Lucene query, e.g. contenttype=project */
  query: string;
  pageSize: number;
  /** Max pages when discover limit is null (safety cap). */
  maxPagesDefault: number;
}

function normalizeHits(payload: CordisSearchEnResponse): CordisSearchEnHit[] {
  const hit = payload.hits?.hit;
  if (!hit) return [];
  return Array.isArray(hit) ? hit : [hit];
}

function cordisPublicUrl(project: CordisProjectRecord): string {
  const ref = project.id?.trim();
  if (ref) return `https://cordis.europa.eu/project/id/${ref}`;
  const rcn = project.rcn?.trim();
  if (rcn) return `https://cordis.europa.eu/project/rcn/${rcn}`;
  throw new Error("CORDIS project has no public URL");
}

function projectToHit(project: CordisProjectRecord): {
  title?: string;
  teaser?: string;
  relatedProjectAcronym?: string;
  relatedProjectReference?: string;
  contentType?: string;
} {
  return {
    title: project.title,
    teaser: project.teaser || project.objective?.slice(0, 500),
    relatedProjectAcronym: project.acronym,
    relatedProjectReference: project.id,
    contentType: project.contenttype,
  };
}

export function parseCordisRecord(page: FetchedPage): NormalisedDraft {
  let project: CordisProjectRecord;
  try {
    project = JSON.parse(page.html) as CordisProjectRecord;
  } catch {
    throw new Error(`CORDIS record is not JSON: ${page.url}`);
  }
  const hit = projectToHit(project);
  const title = hit.title?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`CORDIS record has no title: ${page.url}`);
  if (!cordisHitLooksInnovationRelevant(hit)) {
    throw new Error(`cordis_not_innovation_relevant:${page.url}`);
  }
  const summary = hit.teaser?.replace(/\s+/g, " ").trim() || title;
  const externalId = hit.relatedProjectReference?.trim() || project.rcn?.trim() || page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId,
    summary,
    text: summary,
    resourceType: "PROGRAMME",
    organisationName: hit.relatedProjectAcronym?.trim() || null,
    evidenceBasis: "FUNDER_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { cordis: true, contentType: hit.contentType, grant_record: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

async function fetchCordisSearchPage(
  query: string,
  page: number,
  pageSize: number,
  userAgent: string,
  timeoutMs: number,
): Promise<CordisSearchEnResponse> {
  const params = new URLSearchParams();
  params.set("format", "json");
  params.set("q", query);
  params.set("p", String(page));
  params.set("num", String(Math.min(pageSize, 50)));
  const url = `${CORDIS_SEARCH_EN}?${params.toString()}`;
  return fetchJson<CordisSearchEnResponse>(url, { userAgent, timeoutMs });
}

export function createCordisAdapter(config: CordisAdapterConfig): SourceAdapter {
  return {
    id: config.id,
    fullCatalogue: true,
    skipRobotsGuard: true,
    async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
      const refs: DiscoveredRef[] = [];
      const seenProjectRefs = new Set<string>();
      const pageSize = Math.min(config.pageSize, 50);
      const maxRefs = Math.min(ctx.limit ?? PHASE2_DISCOVER_CAP, PHASE2_DISCOVER_CAP);
      const maxPages = Math.ceil(PHASE2_DISCOVER_CAP / pageSize) + 5;
      const timeoutMs = Math.max(ctx.timeoutMs, 45_000);

      for (let page = 1; page <= maxPages; page += 1) {
        const payload = await fetchCordisSearchPage(config.query, page, pageSize, ctx.userAgent, timeoutMs);
        const hits = normalizeHits(payload);
        if (hits.length === 0) break;
        for (const row of hits) {
          const project = row.project;
          if (!project?.id?.trim()) continue;
          try {
            const hit = projectToHit(project);
            const dedupeKey = project.id.trim();
            if (seenProjectRefs.has(dedupeKey)) continue;
            if (!cordisHitLooksInnovationRelevant(hit)) continue;
            seenProjectRefs.add(dedupeKey);
            const publicUrl = cordisPublicUrl(project);
            refs.push({
              url: publicUrl,
              externalId: dedupeKey,
              listingHtml: JSON.stringify(project),
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
