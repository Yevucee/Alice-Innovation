import type { NeedsReviewBulkFixRow } from "./needs-review-bulk-fix.js";

function looksTruncatedTitle(title: string): boolean {
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

function titleFromSummaryLead(title: string, summary: string): string | null {
  const t = title.trim();
  const s = summary.trim();
  if (!s || s.length <= t.length + 8) return null;
  if (!s.toLowerCase().startsWith(t.toLowerCase())) {
    const firstSentence = s.split(/(?<=[.!?])\s+/)[0]?.trim() ?? s;
    if (firstSentence.length > t.length + 8 && isPlausibleTitle(firstSentence)) return firstSentence;
    return null;
  }
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0]?.trim() ?? s;
  if (firstSentence.length > t.length + 4 && isPlausibleTitle(firstSentence)) return firstSentence;
  return null;
}

function isPlausibleTitle(candidate: string): boolean {
  const t = candidate.trim();
  if (!t || t.length > 180) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 12) return false;
  if (t.endsWith(".") && words.length > 6) return false;
  return true;
}

function titleFromBodyLead(body: string): string | null {
  const chunk = body.trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (!isPlausibleTitle(chunk)) return null;
  if (chunk.split(/\s+/).length < 3) return null;
  return chunk;
}

/** Prefer fuller titles from source_items, metadata, or summary before quality audit. */
export function repairBulkFixTitle(row: NeedsReviewBulkFixRow, title: string): string {
  const candidates: string[] = [title.trim()];
  if (row.source_item_title?.trim()) candidates.push(row.source_item_title.trim());
  candidates.push(...metadataTitleCandidates(row.raw_metadata ?? {}));

  const fromSummary = titleFromSummaryLead(title, row.source_summary);
  if (fromSummary) candidates.push(fromSummary);

  if (row.source_slug === "mit-solve" || looksTruncatedTitle(title)) {
    const fromBody = titleFromBodyLead(row.extracted_index_text);
    if (fromBody) candidates.push(fromBody);
  }

  const tier1 = candidates.filter((c) => isPlausibleTitle(c));
  let best = title.trim();
  for (const candidate of tier1) {
    const c = candidate.trim();
    if (!c) continue;
    const fromCatalogue = c === row.source_item_title?.trim()
      || metadataTitleCandidates(row.raw_metadata ?? {}).includes(c);
    if (fromCatalogue && c.length >= best.length) {
      best = c;
      continue;
    }
    if (c.length > best.length + 3 && isPlausibleTitle(c)) best = c;
    if (looksTruncatedTitle(best) && !looksTruncatedTitle(c) && c.length >= best.length) best = c;
  }
  return best;
}
