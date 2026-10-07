/** Shared heuristics for html-catalogue adapters (nav menus, placeholders, non-innovation pages). */

const NAV_BOILERPLATE_PATTERNS = [
  /\bhome\s+about\s+contact\b/i,
  /\bskip to (main )?content\b/i,
  /\bcookie(s)? (policy|preferences)\b/i,
  /\bprivacy policy\b.*\bterms\b/i,
  /\ball rights reserved\b/i,
  /\bsearch\s+menu\b/i,
  /\b(facebook|linkedin|twitter|instagram)\b.*\b(facebook|linkedin|twitter|instagram)\b/i,
];

const PLACEHOLDER_PATTERNS = [
  /\bsample text\b/i,
  /\blorem ipsum\b/i,
  /\bstartups list\b/i,
  /\bcorporate number[｜|]/i,
  /\bxxx+ sample\b/i,
];

const AUTHOR_BIO_PATH = /\/(author|authors|team|staff|people|profile|member|bio)(\/|$)/i;
const EVENT_PATH = /\/(event|events|calendar|seminar|workshop|conference)(\/|$)/i;

export function isCatalogueNavBoilerplate(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 40) return false;
  return NAV_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(t));
}

export function isCataloguePlaceholderSummary(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(t));
}

export function isNonInnovationCataloguePath(pathname: string): boolean {
  return AUTHOR_BIO_PATH.test(pathname) || EVENT_PATH.test(pathname);
}

export function isLikelyAuthorOrStaffPage(pathname: string, title: string, body: string): boolean {
  if (AUTHOR_BIO_PATH.test(pathname)) return true;
  const combined = `${title} ${body}`.toLowerCase();
  if (/\b(author|editor|staff writer|our team)\b/.test(combined) && /\b(casino|gambling|betting)\b/.test(combined)) {
    return true;
  }
  return false;
}

export function isLikelyEventListingPage(pathname: string, title: string, summary: string): boolean {
  if (EVENT_PATH.test(pathname)) return true;
  const t = `${title} ${summary}`.toLowerCase();
  return /\b(upcoming events?|event poster|register now|rsvp)\b/.test(t);
}

/** Strip J-Startup listing boilerplate from summaries when detail HTML was not parsed. */
export function cleanJStartupSummary(summary: string): string {
  let t = summary.replace(/\s+/g, " ").trim();
  t = t.replace(/(\bsample text\b\s*){1,}/gi, " ").trim();
  t = t.replace(/\bstartups list\b/gi, " ").trim();
  t = t.replace(/corporate number[｜|][^—\-.]*/gi, "").trim();
  return t.replace(/\s+/g, " ").trim();
}

export function catalogueJunkReasons(input: {
  pathname: string;
  title: string;
  summary: string;
  body?: string;
}): string[] {
  const reasons: string[] = [];
  const body = input.body ?? "";
  if (isNonInnovationCataloguePath(input.pathname)) {
    reasons.push("catalogue_non_innovation_path");
  }
  if (isLikelyAuthorOrStaffPage(input.pathname, input.title, body)) {
    reasons.push("catalogue_author_bio");
  }
  if (isLikelyEventListingPage(input.pathname, input.title, input.summary)) {
    reasons.push("catalogue_event_page");
  }
  if (isCatalogueNavBoilerplate(input.summary) || isCatalogueNavBoilerplate(body.slice(0, 2000))) {
    reasons.push("catalogue_nav_boilerplate");
  }
  if (isCataloguePlaceholderSummary(input.summary)) {
    reasons.push("catalogue_placeholder_summary");
  }
  return reasons;
}
