import type { SearchFilters } from "@alice/database";
import { searchWithEmbedding } from "@alice/database";
import { pool } from "./db";

export { searchWithEmbedding };

export interface WebSearchBody {
  query: string;
  resource_types?: string[];
  problems?: string[];
  sectors?: string[];
  technologies?: string[];
  countries?: string[];
  continents?: string[];
  sources?: string[];
  evidence_stages?: string[];
  diverse?: boolean;
  sort?: "relevance" | "newest" | "maturity";
  limit: number;
  offset: number;
}

/** Maps POST /api/search JSON to {@link SearchFilters}, including Africa browse quality. */
export function searchFiltersFromWebBody(input: WebSearchBody): SearchFilters {
  const filters: SearchFilters = {
    query: input.query,
    resourceTypes: input.resource_types,
    problems: input.problems,
    sectors: input.sectors,
    technologies: input.technologies,
    countries: input.countries,
    continents: input.continents,
    sources: input.sources,
    evidenceStages: input.evidence_stages,
    diverse: input.diverse,
    sort: input.sort ?? "relevance",
    limit: input.limit,
    offset: input.offset,
  };
  const continentOnly =
    (input.continents?.length ?? 0) === 1
    && !input.query.trim();
  const continent = continentOnly ? input.continents![0].toLowerCase() : "";
  if (continent === "africa" || continent === "asia") {
    filters.qualityBrowse = true;
    filters.qualityBrowseRelaxed = true;
  }
  return filters;
}

export async function searchLibraryForWeb(filters: SearchFilters) {
  return searchWithEmbedding(pool(), filters);
}
