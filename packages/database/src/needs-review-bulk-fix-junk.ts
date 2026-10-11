import type { NeedsReviewBulkFixRow } from "./needs-review-bulk-fix.js";

export const JUNK_GENERIC_TITLE = "junk_generic_title";
export const JUNK_DUPLICATE_TITLE_CONTENT = "junk_duplicate_title_content";

export const BULK_FIX_JUNK_REASON_CODES = [JUNK_GENERIC_TITLE, JUNK_DUPLICATE_TITLE_CONTENT] as const;

const NAVIGATION_TITLE_EXACT = new Set(
  [
    "advance search",
    "advanced search",
    "search",
    "home",
    "about",
    "contact",
    "menu",
    "read more",
    "portfolio",
    "insights",
    "news",
    "blog",
    "subscribe",
    "share",
    "login",
    "sign in",
  ].map((s) => s.toLowerCase()),
);

/** Source slug → titles that are the site/brand, not catalogue items. */
const SOURCE_SITE_TITLE_KEYS: Record<string, string[]> = {
  "atlas-of-the-future": ["atlas of the future"],
  "nia-innovation-catalogue": ["advance search", "advanced search", "nia innovation catalogue"],
  "china-college-students-innovation-competition": [
    "图解教育",
    "中华人民共和国教育部政府门户网站",
  ],
  "in5-dubai": ["in5 media", "in5 media – green room", "in5 media - green room"],
};

const GOVERNMENT_PORTAL_TITLE = /政府门户网站|教育部政府门户|中华人民共和国教育部/;

const PRODUCT_ORG_TITLE_HINT =
  /(?:solar|water|energy|power|grid|tech|bio|farm|irrigation|filter|pump|cell|battery|carbon|climate|health|med|care|ai\b|led\b|hub|lab|co-?op|systems?|solutions?|ventures?)/i;

function normaliseTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function normaliseBodyKey(body: string): string {
  return body.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

export function contentFingerprint(title: string, body: string): string {
  return `${normaliseTitleKey(title)}|${normaliseBodyKey(body)}`;
}

export type BulkFixDuplicateTracker = Record<string, Record<string, string>>;

/** One-word mit-solve titles that look like product/org names — keep for source_limited, not hide. */
export function looksLikeObviousProductOrOrgName(title: string): boolean {
  const t = title.trim();
  if (!t || t.includes(" ")) return false;
  if (PRODUCT_ORG_TITLE_HINT.test(t)) return true;
  if (/[A-Z]{2,}/.test(t)) return true;
  if (/\d/.test(t)) return true;
  if (t.length >= 9) return true;
  return false;
}

/**
 * Narrow mit-solve stub rule: hide only when body is thin AND title matches linked person_name
 * (mis-parsed team leader as title). Ambiguous one-word names (e.g. "Helio") stay in the normal
 * reconcile path and may become source_limited instead of hidden.
 */
function mitSolveMisParsedPersonTitle(row: NeedsReviewBulkFixRow, title: string, body: string): boolean {
  if (row.source_slug !== "mit-solve") return false;
  if (title.includes(" ") || title.length < 3) return false;
  if (body.trim().length >= 120) return false;
  if (looksLikeObviousProductOrOrgName(title)) return false;
  const person = row.person_name?.trim();
  return Boolean(person && person.toLowerCase() === title.trim().toLowerCase());
}

export function detectBulkFixJunk(
  row: NeedsReviewBulkFixRow,
  titleAfterPropose: string,
  tracker?: BulkFixDuplicateTracker,
): string | null {
  const title = titleAfterPropose.trim() || row.title.trim();
  const key = normaliseTitleKey(title);
  const slug = row.source_slug ?? "unknown";
  const body = row.extracted_index_text || row.source_summary || "";

  if (!title || title.length < 2) return JUNK_GENERIC_TITLE;

  if (NAVIGATION_TITLE_EXACT.has(key)) return JUNK_GENERIC_TITLE;

  // Exact normalised match for site/brand titles (avoids hiding "Atlas of the Future: <project>").
  for (const siteKey of SOURCE_SITE_TITLE_KEYS[slug] ?? []) {
    if (key === siteKey) return JUNK_GENERIC_TITLE;
  }

  // MOE portal: substring via regex on full title (many page title variants).
  if (GOVERNMENT_PORTAL_TITLE.test(title)) return JUNK_GENERIC_TITLE;

  // in5: Green Room appears as a substring in several media page titles.
  if (/green room/i.test(title) && slug === "in5-dubai") return JUNK_GENERIC_TITLE;

  const sourceName =
    typeof row.raw_metadata?.source_name === "string" ? row.raw_metadata.source_name.trim() : "";
  if (sourceName && normaliseTitleKey(sourceName) === key) return JUNK_GENERIC_TITLE;

  if (mitSolveMisParsedPersonTitle(row, title, body)) return JUNK_GENERIC_TITLE;

  if (tracker) {
    const fp = contentFingerprint(title, body);
    const bySource = tracker[slug] ?? {};
    const firstId = bySource[fp];
    if (firstId && firstId !== row.id) return JUNK_DUPLICATE_TITLE_CONTENT;
    bySource[fp] = row.id;
    tracker[slug] = bySource;
  }

  return null;
}
