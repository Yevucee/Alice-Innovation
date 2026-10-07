import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { listingPageFromJson, postJson } from "./http-json.js";

const NIH_SEARCH = "https://api.reporter.nih.gov/v2/projects/search";

interface NihHit {
  appl_id?: number;
  project_title?: string;
  abstract_text?: string;
  org_name?: string;
}

interface NihSearchResponse {
  meta?: { total?: number };
  results?: NihHit[];
}

export interface NihReporterAdapterConfig {
  id: string;
  criteria: Record<string, unknown>;
  pageSize: number;
  maxPagesDefault: number;
}

export function parseNihReporter(page: FetchedPage): NormalisedDraft {
  let hit: NihHit;
  try {
    hit = JSON.parse(page.html) as NihHit;
  } catch {
    throw new Error(`NIH RePORTER record is not JSON: ${page.url}`);
  }
  const title = hit.project_title?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`NIH record has no title: ${page.url}`);
  const summary = hit.abstract_text?.replace(/\s+/g, " ").trim().slice(0, 2000) || title;
  const applId = hit.appl_id;
  if (!applId) throw new Error(`NIH record has no appl_id: ${page.url}`);
  const url = `https://reporter.nih.gov/project-details/${applId}`;
  return buildDraft({
    title,
    url,
    externalId: String(applId),
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "RESEARCH",
    organisationName: hit.org_name?.trim() || null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { nih_reporter: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export function createNihReporterAdapter(config: NihReporterAdapterConfig): SourceAdapter {
  return {
    id: config.id,
    fullCatalogue: true,
    skipRobotsGuard: true,
    async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
      const refs: DiscoveredRef[] = [];
      const pageSize = config.pageSize;
      const maxRefs = ctx.limit ?? config.maxPagesDefault * pageSize;
      const maxPages = config.maxPagesDefault;
      const timeoutMs = Math.max(ctx.timeoutMs, 60_000);

      for (let page = 0; page < maxPages; page += 1) {
        const payload = await postJson<NihSearchResponse>(
          NIH_SEARCH,
          {
            criteria: config.criteria,
            offset: page * pageSize,
            limit: pageSize,
            include_fields: ["ApplId", "ProjectTitle", "AbstractText", "OrgName"],
          },
          { userAgent: ctx.userAgent, timeoutMs },
        );
        const hits = payload.results ?? [];
        if (hits.length === 0) break;
        for (const hit of hits) {
          if (!hit.appl_id || !hit.project_title) continue;
          const url = `https://reporter.nih.gov/project-details/${hit.appl_id}`;
          refs.push({
            url,
            externalId: String(hit.appl_id),
            listingHtml: JSON.stringify(hit),
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
    parse: parseNihReporter,
  };
}
