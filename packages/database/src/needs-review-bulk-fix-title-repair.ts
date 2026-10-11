import type { NeedsReviewBulkFixRow } from "./needs-review-bulk-fix.js";

export function looksTruncatedTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 4) return true;
  const last = trimmed.split(/\s+/).pop() ?? "";
  if (last.length <= 3 && !/[.!?]$/.test(trimmed) && trimmed.length < 25) return true;
  if (/websit$/i.test(trimmed)) return true;
  return false;
}

function stripMitSolveSuffix(title: string): string {
  return title.replace(/\s*\|\s*MIT Solve\s*$/i, "").trim();
}

function metadataTitleCandidates(meta: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["og_title", "ogTitle", "page_title", "display_title", "title"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) out.push(stripMitSolveSuffix(value.trim()));
  }
  return out;
}

function isPlausibleTitle(candidate: string): boolean {
  const t = candidate.trim();
  if (!t || t.length > 180) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 12) return false;
  if (t.endsWith(".") && words.length > 6) return false;
  return true;
}

function extendsTitle(current: string, candidate: string): boolean {
  const c = current.trim();
  const n = candidate.trim();
  if (!c || !n || n.length <= c.length) return false;
  return n.toLowerCase().startsWith(c.toLowerCase());
}

function catalogueTitleCandidates(row: NeedsReviewBulkFixRow): string[] {
  const out: string[] = [];
  if (row.source_item_title?.trim()) out.push(row.source_item_title.trim());
  out.push(...metadataTitleCandidates(row.raw_metadata ?? {}));
  return out.filter((t) => isPlausibleTitle(t));
}

function leadFromTextPrefix(title: string, text: string): string | null {
  const t = title.trim();
  const s = text.trim();
  if (!s || !t) return null;
  if (!s.toLowerCase().startsWith(t.toLowerCase())) return null;
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0]?.trim() ?? s;
  if (firstSentence.length > t.length + 4 && isPlausibleTitle(firstSentence)) return firstSentence;
  return null;
}

function pickCatalogueExtension(current: string, truncated: boolean, row: NeedsReviewBulkFixRow): string | null {
  let best: string | null = null;
  for (const candidate of catalogueTitleCandidates(row)) {
    const allowed = extendsTitle(current, candidate)
      || (truncated && candidate.length > current.length + 3 && !looksTruncatedTitle(candidate));
    if (!allowed) continue;
    if (!best || candidate.length > best.length) best = candidate;
  }
  return best;
}

/** Prefer fuller titles from source_items/metadata only when safe; summary/body only when truncated + prefix match. */
export function repairBulkFixTitle(row: NeedsReviewBulkFixRow, title: string): string {
  const current = title.trim();
  if (!looksTruncatedTitle(current)) {
    const extension = pickCatalogueExtension(current, false, row);
    return extension ?? current;
  }

  let best = current;
  const extension = pickCatalogueExtension(current, true, row);
  if (extension && extension.length > best.length) best = extension;

  const fromSummary = leadFromTextPrefix(best, row.source_summary);
  if (fromSummary && fromSummary.length > best.length) best = fromSummary;

  const fromBody = leadFromTextPrefix(best, row.extracted_index_text);
  if (fromBody && fromBody.length > best.length) best = fromBody;

  return best;
}
