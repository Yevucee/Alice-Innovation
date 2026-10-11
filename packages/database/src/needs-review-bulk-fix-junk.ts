import type { NeedsReviewBulkFixRow } from "./needs-review-bulk-fix.js";

export const JUNK_GENERIC_TITLE = "junk_generic_title";
export const JUNK_DUPLICATE_TITLE_CONTENT = "junk_duplicate_title_content";

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

  for (const siteKey of SOURCE_SITE_TITLE_KEYS[slug] ?? []) {
    if (key === siteKey || key.includes(siteKey)) return JUNK_GENERIC_TITLE;
  }

  if (GOVERNMENT_PORTAL_TITLE.test(title)) return JUNK_GENERIC_TITLE;

  if (/green room/i.test(title) && slug === "in5-dubai") return JUNK_GENERIC_TITLE;

  const sourceName =
    typeof row.raw_metadata?.source_name === "string" ? row.raw_metadata.source_name.trim() : "";
  if (sourceName && normaliseTitleKey(sourceName) === key) return JUNK_GENERIC_TITLE;

  if (slug === "mit-solve" && /^[A-Z][a-z]{2,12}$/.test(title) && !title.includes(" ")) {
    const bodyLen = body.trim().length;
    if (bodyLen < 120) return JUNK_GENERIC_TITLE;
  }

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
