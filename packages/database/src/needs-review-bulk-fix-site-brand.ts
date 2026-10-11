import type { NeedsReviewBulkFixRow } from "./needs-review-bulk-fix.js";
import { repairBulkFixTitle } from "./needs-review-bulk-fix-title-repair.js";

function normaliseTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalised site/brand placeholder titles that should be repaired, not hidden when a project URL exists. */
export const SITE_BRAND_PLACEHOLDER_BY_SLUG: Record<string, string> = {
  "atlas-of-the-future": "atlas of the future",
  "digital-africa": "digital africa",
  "ventures-platform": "ventures platform",
};

export function isSiteBrandPlaceholderTitle(sourceSlug: string | null, title: string): boolean {
  if (!sourceSlug) return false;
  const brand = SITE_BRAND_PLACEHOLDER_BY_SLUG[sourceSlug];
  if (!brand) return false;
  return normaliseTitleKey(title) === brand;
}

export function titleCaseFromUrlSlug(slug: string): string {
  const stripped = slug.replace(/-\d+$/i, "").trim();
  if (!stripped || stripped.length < 2) return "";
  return stripped
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Derive a human title from portfolio/project path segments. */
export function titleFromProjectCanonicalUrl(canonicalUrl: string | null): string | null {
  if (!canonicalUrl?.trim()) return null;
  try {
    const parts = new URL(canonicalUrl).pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const last = parts[parts.length - 1]!.toLowerCase();
    if (["project", "portfolio", "portfolio-companies", "en"].includes(last)) {
      if (parts.length < 2) return null;
      return titleCaseFromUrlSlug(parts[parts.length - 2]!) || null;
    }
    return titleCaseFromUrlSlug(parts[parts.length - 1]!) || null;
  } catch {
    return null;
  }
}

function metadataTitleCandidates(meta: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["og_title", "ogTitle", "page_title", "display_title", "title"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) out.push(value.trim());
  }
  return out;
}

function pickBestSiteBrandReplacement(row: NeedsReviewBulkFixRow, brandKey: string): string | null {
  const candidates: string[] = [];
  if (row.source_item_title?.trim()) candidates.push(row.source_item_title.trim());
  candidates.push(...metadataTitleCandidates(row.raw_metadata ?? {}));
  const fromUrl = titleFromProjectCanonicalUrl(row.canonical_url);
  if (fromUrl) candidates.push(fromUrl);

  const body = row.extracted_index_text || row.source_summary || "";
  const repaired = repairBulkFixTitle(row, row.title);
  if (repaired && normaliseTitleKey(repaired) !== brandKey) candidates.push(repaired);

  let best: string | null = null;
  for (const candidate of candidates) {
    const c = candidate.trim();
    if (!c || normaliseTitleKey(c) === brandKey) continue;
    if (c.length < 3) continue;
    if (!best || c.length > best.length) best = c;
  }
  return best;
}

/** When the row title is only the site name, try catalogue metadata, body repair, or URL slug. */
export function repairSiteBrandPlaceholderTitle(row: NeedsReviewBulkFixRow, title: string): string {
  const slug = row.source_slug;
  if (!isSiteBrandPlaceholderTitle(slug, title)) return title.trim();
  const brandKey = SITE_BRAND_PLACEHOLDER_BY_SLUG[slug!]!;
  const replacement = pickBestSiteBrandReplacement(row, brandKey);
  return replacement ?? title.trim();
}
