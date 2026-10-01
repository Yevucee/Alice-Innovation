import { continentNamesForFilter } from "@alice/taxonomy";
import { QUALITY_BROWSE_EXTRA_SQL, qualityBrowseBlocklistParam } from "./quality-browse-sql.js";

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
}

function arr(values: string[] | undefined): string[] | null {
  if (!values || values.length === 0) return null;
  return values;
}

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
    r.review_status NOT IN ('NEEDS_REVIEW', 'ARCHIVED')
    AND char_length(trim(coalesce(r.source_summary, ''))) >= 40
    ${QUALITY_BROWSE_EXTRA_SQL}
  ))
`;

export function filterParams(filters: SearchFilters): unknown[] {
  const countries = arr(filters.countries)?.map((value) => value.toLowerCase()) ?? null;
  const continents = continentNamesForFilter(arr(filters.continents) ?? []);
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
    filters.qualityBrowse === true,
    qualityBrowseBlocklistParam(),
  ];
}

export const OR_TERM_MATCH_COUNT_SQL = `
  (
    SELECT count(*)::int
    FROM regexp_split_to_table(lower(trim($1)), '\\s+') AS term(word)
    WHERE length(word) >= 2
      AND r.search_vector @@ plainto_tsquery('english', word)
  )
`;
