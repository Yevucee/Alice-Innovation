/** Registration / legal-form strings that must never show as organisation names. */

const LEGAL_FORM_PATTERNS: RegExp[] = [
  /not registered as any organization/i,
  /not registered as any organisation/i,
  /hybrid of for-profit and nonprofit/i,
  /other, including part of a larger organization/i,
  /^for-profit\b/i,
  /^for-profit$/i,
  /^nonprofit$/i,
  /^non-profit$/i,
  /^not applicable$/i,
  /^n\/a$/i,
  /b-corp/i,
  /legal form/i,
  /sole proprietorship/i,
  /public benefit corporation/i,
];

/** For SQL `~*` checks on organisation names (keep in sync with {@link isLegalFormText}). */
export const LEGAL_FORM_ORG_SQL_PATTERN =
  "not registered as any organization|not registered as any organisation|hybrid of for-profit|other, including part of a larger organization|^(for-profit|nonprofit|non-profit|not applicable|n/a)$|b-corp|legal form|sole proprietorship|public benefit";

export function isLegalFormText(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  return LEGAL_FORM_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Strip leading markdown heading markers mistakenly stored as titles. */
export function sanitizeDisplayTitle(title: string): string {
  return title.replace(/^#+\s*/, "").trim();
}

export function sanitizeIngestTitle(title: string): string {
  return sanitizeDisplayTitle(title);
}

/** Pandemic-era junk phrases excluded from qualityBrowse surfaces (any ingest date). */
export const QUALITY_BROWSE_PANDEMIC_PATTERN =
  "covid-19|covid 19|covid|coronavirus|sars-cov|pandemic|pseudoventilator|pseudo ventilator|ambu bag|reopening|safer reopening|humidified hot air|quarantine|lockdown|ventilator|tele health";

export function isQualityBrowsePandemicJunk(title: string, summary: string): boolean {
  const haystack = `${title}\n${summary}`.toLowerCase();
  const terms = [
    "covid-19",
    "covid 19",
    "covid",
    "coronavirus",
    "pandemic",
    "ventilator",
    "pseudoventilator",
    "ambu bag",
    "reopening",
    "lockdown",
    "quarantine",
    "tele health",
  ];
  return terms.some((term) => haystack.includes(term));
}
