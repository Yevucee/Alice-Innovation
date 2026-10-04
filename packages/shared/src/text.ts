const TAG_RE = /<[^>]+>/g;
const SCRIPT_RE = /<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function htmlToText(html: string): string {
  const withoutHidden = html.replace(SCRIPT_RE, " ");
  return withoutHidden
    .replace(TAG_RE, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, max: number): string {
  return truncateAtWordBoundary(value, max);
}

/** Truncate at last word boundary before max; never mid-word. */
export function truncateAtWordBoundary(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  if (max <= 1) return "…";
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(max * 0.5) ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Browser-safe re-exports (no node:crypto / node:fs). Use this path from Next client components. */
export {
  isLegalFormText,
  isQualityBrowsePandemicJunk,
  sanitizeDisplayTitle,
  sanitizeIngestTitle,
} from "./legal-form.js";
