import { continentNamesForFilter } from "@alice/taxonomy";
import {
  QUALITY_BROWSE_COMPLETENESS_ORDER_SQL,
  QUALITY_BROWSE_ORDER_SQL,
  qualityBrowseBlocklistParam,
  qualityBrowseExtraSql,
} from "./quality-browse-sql.js";

export { QUALITY_BROWSE_ORDER_SQL, QUALITY_BROWSE_COMPLETENESS_ORDER_SQL };

export interface SearchFilters {
  query: string;
  resourceTypes?: string[];
  countries?: string[];
  continents?: string[];
  sources?: string[];
  sectors?: string[];
  problems?: string[];
  technologies?: string[];
  evidenceStages?: string[];
  limit: number;
  offset: number;
  diverse?: boolean;
  diversity?: "source" | "mechanism";
  sort?: "relevance" | "newest" | "maturity";
  qualityBrowse?: boolean;
  /** When true with qualityBrowse, uses relaxed filters (From Africa row). */
  qualityBrowseRelaxed?: boolean;
}

function arr(values: string[] | undefined): string[] | null {
  if (!values || values.length === 0) return null;
  return values;
}

/**
 * Binds $1 (query text) when a statement uses {@link FILTER_SQL} but not lexical clauses.
 * Postgres cannot infer types for unused parameters (42P18).
 */
export const FILTER_QUERY_TEXT_BIND_SQL = "($1::text IS NOT NULL)";

export const FILTER_SQL = `
  r.active = true
  AND ($2::text[] IS NULL OR r.resource_type = ANY($2))
  AND ($3::text[] IS NULL OR r.evidence_stage = ANY($3))
  AND ($4::text[] IS NULL OR EXISTS (
    SELECT 1 FROM resource_source_links l
    JOIN source_items si ON si.id = l.source_item_id
    JOIN sources s ON s.id = si.source_id
    WHERE l.resource_id = r.id AND s.slug = ANY($4)
  ))
  AND ($5::text[] IS NULL OR EXISTS (
    SELECT 1 FROM resource_locations rl
    JOIN locations loc ON loc.id = rl.location_id
    WHERE rl.resource_id = r.id
      AND (
        upper(loc.country_code) = ANY(SELECT upper(unnest($5::text[])))
        OR lower(loc.country_name) = ANY(SELECT lower(unnest($5::text[])))
      )
  ) OR upper(r.primary_country_code) = ANY(SELECT upper(unnest($5::text[]))))
  AND ($9::text[] IS NULL OR EXISTS (
    SELECT 1 FROM resource_locations rl
    JOIN locations loc ON loc.id = rl.location_id
    WHERE rl.resource_id = r.id
      AND loc.continent IS NOT NULL
      AND loc.continent = ANY($9::text[])
  ) OR (
    $9::text[] IS NOT NULL AND 'Africa' = ANY($9::text[]) AND EXISTS (
      SELECT 1 FROM resource_source_links l_af
      JOIN source_items si_af ON si_af.id = l_af.source_item_id
      JOIN sources s_af ON s_af.id = si_af.source_id
      WHERE l_af.resource_id = r.id AND s_af.enabled AND s_af.category = 'africa-innovation'
    )
  ))
  AND ($6::text[] IS NULL OR EXISTS (
    SELECT 1 FROM resource_sectors rs
    JOIN sectors sec ON sec.id = rs.sector_id
    WHERE rs.resource_id = r.id AND sec.slug = ANY($6)
  ))
  AND ($7::text[] IS NULL OR EXISTS (
    SELECT 1 FROM resource_problems rp
    JOIN problems p ON p.id = rp.problem_id
    WHERE rp.resource_id = r.id AND p.slug = ANY($7)
  ))
  AND ($8::text[] IS NULL OR EXISTS (
    SELECT 1 FROM resource_technologies rt
    JOIN technologies t ON t.id = rt.technology_id
    WHERE rt.resource_id = r.id AND t.slug = ANY($8)
  ))
  AND ($10::boolean IS NOT TRUE OR (
    r.review_status NOT IN ('NEEDS_REVIEW', 'ARCHIVED', 'SOURCE_LIMITED')
    AND char_length(trim(coalesce(r.source_summary, ''))) >= 40
    ${qualityBrowseExtraSql(false)}
  ))
  AND ($12::boolean IS NOT TRUE OR (
    r.review_status NOT IN ('NEEDS_REVIEW', 'ARCHIVED', 'SOURCE_LIMITED')
    AND char_length(trim(coalesce(r.source_summary, ''))) >= 40
    ${qualityBrowseExtraSql(true)}
  ))
`;

/** Positional params produced by {@link filterParams} ($1 … $FILTER_PARAM_COUNT). */
export const FILTER_PARAM_COUNT = 12;

/** $1 query, $2–$9 filters, $10 strict qualityBrowse, $11 blocklist, $12 relaxed qualityBrowse. */
export const SEMANTIC_EMBEDDING_PARAM = FILTER_PARAM_COUNT + 1;
export const SEMANTIC_MAX_DISTANCE_PARAM = FILTER_PARAM_COUNT + 2;

export function filterParams(filters: SearchFilters): unknown[] {
  const countries = arr(filters.countries)?.map((value) => value.toLowerCase()) ?? null;
  const continents = continentNamesForFilter(arr(filters.continents) ?? []);
  const strictQualityBrowse = filters.qualityBrowse === true && filters.qualityBrowseRelaxed !== true;
  const relaxedQualityBrowse = filters.qualityBrowse === true && filters.qualityBrowseRelaxed === true;
  return [
    filters.query,
    arr(filters.resourceTypes),
    arr(filters.evidenceStages),
    arr(filters.sources),
    countries,
    arr(filters.sectors),
    arr(filters.problems),
    arr(filters.technologies),
    continents,
    strictQualityBrowse,
    qualityBrowseBlocklistParam(),
    relaxedQualityBrowse,
  ];
}

export function appendSemanticQueryParams(
  filterBindParams: unknown[],
  queryEmbedding: number[],
  maxDistance: number,
): unknown[] {
  if (filterBindParams.length !== FILTER_PARAM_COUNT) {
    throw new Error(
      `filterParams length ${filterBindParams.length} !== ${FILTER_PARAM_COUNT}`,
    );
  }
  return [...filterBindParams, `[${queryEmbedding.join(",")}]`, maxDistance];
}

/** Distance predicate for hybrid semantic search (embedding + max distance appended after filter params). */
export function semanticDistancePredicateSql(): string {
  return `(r.embedding <=> $${SEMANTIC_EMBEDDING_PARAM}::vector) <= $${SEMANTIC_MAX_DISTANCE_PARAM}::float8`;
}

export function semanticOrderByDistanceSql(): string {
  return `r.embedding <=> $${SEMANTIC_EMBEDDING_PARAM}::vector`;
}

export const OR_TERM_MATCH_COUNT_SQL = `
  (
    SELECT count(*)::int
    FROM regexp_split_to_table(lower(trim($1)), '\\s+') AS term(word)
    WHERE length(word) >= 2
      AND r.search_vector @@ plainto_tsquery('english', word)
  )
`;
