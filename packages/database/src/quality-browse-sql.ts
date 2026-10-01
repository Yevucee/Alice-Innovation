/** SQL fragments for public browse surfaces (homepage, Africa hub). Mirrors ingest quality gate heuristics. */

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
    AND GREATEST(
      char_length(trim(coalesce(r.source_summary, ''))),
      char_length(trim(coalesce(r.extracted_index_text, '')))
    ) >= 80
    AND char_length(trim(coalesce(r.canonical_title, ''))) >= 4
    AND lower(trim(r.canonical_title)) <> ALL($11::text[])
    AND NOT (r.canonical_title ~* 'websit$')
    AND NOT (
      length(regexp_replace(r.canonical_title, '[^A-Za-z]', '', 'g')) > 6
      AND upper(r.canonical_title) = r.canonical_title
      AND r.canonical_title ~ '[A-Z]'
    )
    AND NOT (
      (
        r.canonical_title ~* '(covid|coronavirus|sars-cov|pandemic|lockdown|quarantine)'
        OR r.source_summary ~* '(covid-19|coronavirus pandemic|during the pandemic)'
      )
      AND coalesce(r.created_at, r.updated_at) < '2023-01-01'::timestamptz
    )
`;

export function qualityBrowseBlocklistParam(): string[] {
  return [...QUALITY_BROWSE_BLOCKLIST_TITLES];
}
