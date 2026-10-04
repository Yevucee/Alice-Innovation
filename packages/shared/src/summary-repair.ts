import { truncateAtWordBoundary } from "./text.js";

function normalisedKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isSlugLikeSummary(summary: string): boolean {
  const s = summary.trim();
  if (!s || s.includes(" ")) return false;
  if (s.length < 8) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)+$/i.test(s);
}

export function summaryEqualsTitle(title: string, summary: string): boolean {
  if (!title.trim() || !summary.trim()) return false;
  return normalisedKey(title) === normalisedKey(summary);
}

function firstSubstantialParagraph(text: string, minLen = 40): string {
  const chunks = text
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= minLen);
  for (const chunk of chunks) {
    if (!isSlugLikeSummary(chunk) && chunk.length >= minLen) return chunk;
  }
  const sentences = text.replace(/\s+/g, " ").trim();
  if (sentences.length >= minLen) return sentences.split(/(?<=[.!?])\s+/)[0]?.trim() ?? sentences;
  return "";
}

/** Avoid title-as-summary and slug summaries; prefer body or meta description. */
export function repairSourceSummary(input: {
  title: string;
  summary: string;
  bodyText: string;
  metaDescription?: string | null;
  maxLength?: number;
}): string {
  const max = input.maxLength ?? 500;
  let summary = input.summary.trim();
  const title = input.title.trim();
  const meta = input.metaDescription?.trim() ?? "";

  if (summaryEqualsTitle(title, summary) || isSlugLikeSummary(summary) || summary.length < 20) {
    const fromMeta =
      meta && !summaryEqualsTitle(title, meta) && !isSlugLikeSummary(meta) ? meta : "";
    const fromBody = firstSubstantialParagraph(input.bodyText);
    summary = fromMeta || fromBody || "";
  }

  if (summaryEqualsTitle(title, summary) || isSlugLikeSummary(summary)) {
    return "";
  }

  return truncateAtWordBoundary(summary, max);
}

/** When title was truncated at a colon, reattach a short subtitle from the summary. */
export function mergeColonSplitTitle(title: string, summary: string): { title: string; summary: string } {
  const t = title.trim();
  let s = summary.trim();
  if (!/:\s*$/.test(t) || !s) return { title: t, summary: s };

  const firstChunk = s.split(/(?<=[.!?])\s+/)[0]?.trim() ?? s;
  const subtitleWords = firstChunk.split(/\s+/).filter(Boolean);
  if (subtitleWords.length === 0 || subtitleWords.length > 12) return { title: t, summary: s };

  const mergedTitle = `${t} ${firstChunk}`.replace(/\s+/g, " ").trim();
  const remainder = s.slice(firstChunk.length).trim().replace(/^[.!?]\s*/, "");
  return { title: mergedTitle, summary: remainder || s };
}

export function normaliseCountryDisplayName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const trimmed = name.trim();
  if (/^usa$/i.test(trimmed) || trimmed === "Usa") return "USA";
  return trimmed;
}
