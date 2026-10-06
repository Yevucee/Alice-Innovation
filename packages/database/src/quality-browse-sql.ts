/** SQL fragments for public browse surfaces (homepage, Africa hub). Mirrors ingest quality gate heuristics. */

import { LEGAL_FORM_ORG_SQL_PATTERN, QUALITY_BROWSE_PANDEMIC_PATTERN } from "@alice/shared";

export const QUALITY_BROWSE_BLOCKLIST_TITLES = [
  "home",
  "about",
  "contact",
  "portfolio",
  "privacy",
  "terms",
  "cookies",
  "login",
  "sign in",
  "search",
  "menu",
  "accelerating the future",
  "bitpanda websit",
] as const;

const QUALITY_BROWSE_BODY_LENGTH_SQL = `
    AND GREATEST(
      char_length(trim(coalesce(r.source_summary, ''))),
      char_length(trim(coalesce(r.extracted_index_text, '')))
    ) >= 80`;

const QUALITY_BROWSE_BODY_LENGTH_RELAXED_SQL = `
    AND GREATEST(
      char_length(trim(coalesce(r.source_summary, ''))),
      char_length(trim(coalesce(r.extracted_index_text, '')))
    ) >= 40`;

const QUALITY_BROWSE_TITLE_RULES_SQL = `
    AND char_length(trim(coalesce(r.canonical_title, ''))) >= 4
    AND lower(trim(r.canonical_title)) <> ALL($11::text[])
    AND NOT (r.canonical_title ~* 'websit$')
    AND NOT (r.canonical_title ~ '^#+\\s')
    AND NOT (
      length(regexp_replace(r.canonical_title, '[^A-Za-z]', '', 'g')) > 6
      AND upper(r.canonical_title) = r.canonical_title
      AND r.canonical_title ~ '[A-Z]'
    )
    AND NOT (
      r.canonical_title ~* '${QUALITY_BROWSE_PANDEMIC_PATTERN}'
      OR r.source_summary ~* '${QUALITY_BROWSE_PANDEMIC_PATTERN}'
      OR r.extracted_index_text ~* '${QUALITY_BROWSE_PANDEMIC_PATTERN}'
    )
    AND lower(trim(coalesce(r.source_summary, ''))) <> lower(trim(coalesce(r.canonical_title, '')))
    AND NOT EXISTS (
      SELECT 1 FROM resource_organisations ro_j
      JOIN organisations o_j ON o_j.id = ro_j.organisation_id
      WHERE ro_j.resource_id = r.id
        AND ro_j.is_primary IS TRUE
        AND o_j.name ~* '${LEGAL_FORM_ORG_SQL_PATTERN}'
    )`;

const QUALITY_BROWSE_TITLE_RULES_RELAXED_SQL = `
    AND char_length(trim(coalesce(r.canonical_title, ''))) >= 4
    AND lower(trim(r.canonical_title)) <> ALL($11::text[])
    AND NOT (r.canonical_title ~* 'websit$')
    AND NOT (r.canonical_title ~ '^#+\\s')
    AND NOT (
      r.canonical_title ~* '${QUALITY_BROWSE_PANDEMIC_PATTERN}'
      OR r.source_summary ~* '${QUALITY_BROWSE_PANDEMIC_PATTERN}'
      OR r.extracted_index_text ~* '${QUALITY_BROWSE_PANDEMIC_PATTERN}'
    )
    AND lower(trim(coalesce(r.source_summary, ''))) <> lower(trim(coalesce(r.canonical_title, '')))`;

/** Appended inside FILTER_SQL when qualityBrowse is true (strict homepage / Recently added). */
export const QUALITY_BROWSE_EXTRA_SQL = `
    AND r.resource_type <> 'ARTICLE'
    ${QUALITY_BROWSE_BODY_LENGTH_SQL}
    ${QUALITY_BROWSE_TITLE_RULES_SQL}
`;

/** Relaxed browse (From Africa row): no all-caps / legal-org exclusions; shorter body threshold. */
export const QUALITY_BROWSE_RELAXED_EXTRA_SQL = `
    AND r.resource_type <> 'ARTICLE'
    ${QUALITY_BROWSE_BODY_LENGTH_RELAXED_SQL}
    ${QUALITY_BROWSE_TITLE_RULES_RELAXED_SQL}
`;

export function qualityBrowseExtraSql(relaxed: boolean): string {
  return relaxed ? QUALITY_BROWSE_RELAXED_EXTRA_SQL : QUALITY_BROWSE_EXTRA_SQL;
}

export function qualityBrowseBlocklistParam(): string[] {
  return [...QUALITY_BROWSE_BLOCKLIST_TITLES];
}

export const QUALITY_BROWSE_ORDER_SQL = `
  CASE
    WHEN lower(trim(coalesce(r.source_summary, ''))) = lower(trim(coalesce(r.canonical_title, ''))) THEN 1
    WHEN char_length(trim(coalesce(r.source_summary, ''))) < 60 THEN 1
    ELSE 0
  END,
  r.created_at DESC NULLS LAST
`;

/** Prefer rows with image, organisation, and richer summaries (relaxed Africa browse). */
export const QUALITY_BROWSE_COMPLETENESS_ORDER_SQL = `
  (
    CASE WHEN EXISTS (
      SELECT 1 FROM resource_source_links l_img
      JOIN source_items si_img ON si_img.id = l_img.source_item_id
      WHERE l_img.resource_id = r.id
        AND si_img.image_url IS NOT NULL
        AND btrim(si_img.image_url) <> ''
        AND si_img.image_url NOT LIKE 'data:%'
    ) THEN 0 ELSE 1 END
    + CASE WHEN EXISTS (
      SELECT 1 FROM resource_organisations ro_c
      JOIN organisations o_c ON o_c.id = ro_c.organisation_id
      WHERE ro_c.resource_id = r.id
        AND NOT (o_c.name ~* '${LEGAL_FORM_ORG_SQL_PATTERN}')
    ) THEN 0 ELSE 1 END
    + CASE WHEN char_length(trim(coalesce(r.source_summary, ''))) < 120 THEN 1 ELSE 0 END
  ) ASC,
  ${QUALITY_BROWSE_ORDER_SQL.trim()}
`;
