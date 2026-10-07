import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";

const GTR_API = "https://gtr.ukri.org/gtr/api/projects";

interface GtrProject {
  id?: string;
  title?: string;
  abstractText?: string;
  href?: string;
}

interface GtrListResponse {
  totalSize?: number;
  page?: number;
  totalPages?: number;
  project?: GtrProject[];
}

export function parseUkriGtr(page: FetchedPage): NormalisedDraft {
  let hit: GtrProject;
  try {
    hit = JSON.parse(page.html) as GtrProject;
  } catch {
    throw new Error(`UKRI GTR record is not JSON: ${page.url}`);
  }
  const title = hit.title?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`GTR project has no title: ${page.url}`);
  const summary = hit.abstractText?.replace(/\s+/g, " ").trim().slice(0, 2000) || title;
  const id = hit.id?.trim();
  if (!id) throw new Error(`GTR project has no id: ${page.url}`);
  const url = `https://gtr.ukri.org/projects/${id}`;
  return buildDraft({
    title,
    url,
    externalId: id,
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "RESEARCH",
    organisationName: null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { ukri_gtr: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const ukriGtrProjectsAdapter: SourceAdapter = {
  id: "ukri-gtr-research-projects",
  fullCatalogue: true,
  skipRobotsGuard: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const refs: DiscoveredRef[] = [];
    const pageSize = 50;
    const maxPagesDefault = 80;
    const maxRefs = ctx.limit ?? maxPagesDefault * pageSize;
    const maxPages = maxPagesDefault;
    const timeoutMs = Math.max(ctx.timeoutMs, 45_000);

    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${GTR_API}?fetchSize=${pageSize}&page=${page}&selectedSortableField=pro.s&selectedSortOrder=DESC`;
      const payload = await fetchJson<GtrListResponse>(url, { userAgent: ctx.userAgent, timeoutMs });
      const projects = payload.project ?? [];
      if (projects.length === 0) break;
      for (const project of projects) {
        if (!project.id || !project.title) continue;
        const publicUrl = `https://gtr.ukri.org/projects/${project.id}`;
        refs.push({
          url: publicUrl,
          externalId: project.id,
          listingHtml: JSON.stringify(project),
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
  parse: parseUkriGtr,
};
