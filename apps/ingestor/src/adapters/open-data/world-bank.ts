import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { fetchJson, listingPageFromJson } from "./http-json.js";

const WB_API = "https://search.worldbank.org/api/v2/projects";

interface WbProject {
  id?: string;
  project_name?: string;
  projectstatusdisplay?: string;
  countryshortname?: string;
  url?: string;
}

interface WbResponse {
  total?: string;
  projects?: Record<string, WbProject>;
}

export function parseWorldBankProject(page: FetchedPage): NormalisedDraft {
  let hit: WbProject;
  try {
    hit = JSON.parse(page.html) as WbProject;
  } catch {
    throw new Error(`World Bank record is not JSON: ${page.url}`);
  }
  const title = hit.project_name?.replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`World Bank project has no title: ${page.url}`);
  const summary = `${title}. Status: ${hit.projectstatusdisplay ?? "unknown"}. Country: ${hit.countryshortname ?? "unknown"}.`;
  const id = hit.id?.trim();
  if (!id) throw new Error(`World Bank project has no id: ${page.url}`);
  const url = hit.url?.trim() || `https://projects.worldbank.org/en/projects-operations/project-detail/${id}`;
  return buildDraft({
    title,
    url,
    externalId: id,
    summary,
    text: summary,
    resourceType: "PROJECT",
    organisationName: null,
    countryName: hit.countryshortname?.trim() || null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { world_bank: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const worldBankProjectsAdapter: SourceAdapter = {
  id: "world-bank-development-projects",
  fullCatalogue: true,
  skipRobotsGuard: true,
  async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
    const refs: DiscoveredRef[] = [];
    const pageSize = 50;
    const maxPagesDefault = 60;
    const maxRefs = ctx.limit ?? maxPagesDefault * pageSize;
    const maxPages = maxPagesDefault;
    const timeoutMs = Math.max(ctx.timeoutMs, 45_000);

    for (let page = 1; page <= maxPages; page += 1) {
      const os = (page - 1) * pageSize;
      const url = `${WB_API}?format=json&rows=${pageSize}&os=${os}`;
      const payload = await fetchJson<WbResponse>(url, { userAgent: ctx.userAgent, timeoutMs });
      const projects = Object.values(payload.projects ?? {});
      if (projects.length === 0) break;
      for (const project of projects) {
        if (!project.id || !project.project_name) continue;
        const publicUrl = project.url?.trim()
          || `https://projects.worldbank.org/en/projects-operations/project-detail/${project.id}`;
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
  parse: parseWorldBankProject,
};
