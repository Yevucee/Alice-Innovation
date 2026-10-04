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

/** Appended inside FILTER_SQL when qualityBrowse is true (after summary length check). */
export const QUALITY_BROWSE_EXTRA_SQL = `
    AND r.resource_type <> 'ARTICLE'
    AND GREATEST(
      char_length(trim(coalesce(r.source_summary, ''))),
      char_length(trim(coalesce(r.extracted_index_text, '')))
    ) >= 80
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
    )
`;

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
