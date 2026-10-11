import type { NeedsReviewBulkFixRow } from "./needs-review-bulk-fix.js";
import {
  isSiteBrandPlaceholderTitle,
  repairSiteBrandPlaceholderTitle,
} from "./needs-review-bulk-fix-site-brand.js";

export const JUNK_GENERIC_TITLE = "junk_generic_title";
export const JUNK_DUPLICATE_TITLE_CONTENT = "junk_duplicate_title_content";

export const BULK_FIX_JUNK_REASON_CODES = [JUNK_GENERIC_TITLE, JUNK_DUPLICATE_TITLE_CONTENT] as const;

export interface BulkFixJunkHit {
  code: string;
  rule: string;
}

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

/** Always hide (no project repair) — navigation / catalogue chrome. */
const SOURCE_SITE_TITLE_KEYS: Record<string, string[]> = {
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

function normaliseBodySlice(body: string, maxLen: number): string {
  return body.trim().toLowerCase().replace(/\s+/g, " ").slice(0, maxLen);
}

/** Duplicate detection: title + canonical URL + external id + long body slice (avoids same-title patents). */
export function contentFingerprint(
  title: string,
  body: string,
  canonicalUrl: string | null,
  externalId?: string | null,
): string {
  const urlKey = canonicalUrl?.trim().toLowerCase() ?? "";
  const extKey = externalId?.trim() ?? "";
  const bodyKey = normaliseBodySlice(body, 400);
  return `${normaliseTitleKey(title)}|${urlKey}|${extKey}|${bodyKey}`;
}

export type BulkFixDuplicateTracker = Record<string, Record<string, string>>;

export function looksLikeObviousProductOrOrgName(title: string): boolean {
  const t = title.trim();
  if (!t || t.includes(" ")) return false;
  if (PRODUCT_ORG_TITLE_HINT.test(t)) return true;
  if (/[A-Z]{2,}/.test(t)) return true;
  if (/\d/.test(t)) return true;
  if (t.length >= 9) return true;
  return false;
}

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
): BulkFixJunkHit | null {
  const title = titleAfterPropose.trim() || row.title.trim();
  const key = normaliseTitleKey(title);
  const slug = row.source_slug ?? "unknown";
  const body = row.extracted_index_text || row.source_summary || "";

  if (!title) return { code: JUNK_GENERIC_TITLE, rule: "empty_title" };

  if (title.length === 1) return { code: JUNK_GENERIC_TITLE, rule: "single_letter_title" };

  if (NAVIGATION_TITLE_EXACT.has(key)) return { code: JUNK_GENERIC_TITLE, rule: "navigation_title" };

  for (const siteKey of SOURCE_SITE_TITLE_KEYS[slug] ?? []) {
    if (key === siteKey) return { code: JUNK_GENERIC_TITLE, rule: "site_chrome_title" };
  }

  if (GOVERNMENT_PORTAL_TITLE.test(title)) {
    return { code: JUNK_GENERIC_TITLE, rule: "government_portal_title" };
  }

  if (/green room/i.test(title) && slug === "in5-dubai") {
    return { code: JUNK_GENERIC_TITLE, rule: "in5_green_room_title" };
  }

  const sourceName =
    typeof row.raw_metadata?.source_name === "string" ? row.raw_metadata.source_name.trim() : "";
  if (sourceName && normaliseTitleKey(sourceName) === key) {
    return { code: JUNK_GENERIC_TITLE, rule: "source_name_equals_title" };
  }

  if (mitSolveMisParsedPersonTitle(row, title, body)) {
    return { code: JUNK_GENERIC_TITLE, rule: "mit_solve_person_name_stub" };
  }

  if (isSiteBrandPlaceholderTitle(slug, title)) {
    const repaired = repairSiteBrandPlaceholderTitle(row, title);
    if (normaliseTitleKey(repaired) === key) {
      return { code: JUNK_GENERIC_TITLE, rule: "site_brand_title_unrepaired" };
    }
    return null;
  }

  if (tracker) {
    const fp = contentFingerprint(title, body, row.canonical_url, row.source_external_id);
    const bySource = tracker[slug] ?? {};
    const firstId = bySource[fp];
    if (firstId && firstId !== row.id) {
      return { code: JUNK_DUPLICATE_TITLE_CONTENT, rule: "duplicate_title_url_body" };
    }
    bySource[fp] = row.id;
    tracker[slug] = bySource;
  }

  return null;
}
