import { PROBLEMS, SECTORS, inferTaxonomyFromText } from "@alice/taxonomy";

export interface EnrichmentPayload {
  country?: string;
  city?: string;
  stage?: string;
  problem?: string;
  sector?: string;
  organisation_name?: string;
}

const UNKNOWN = new Set(["unknown", "n/a", "na", "none", ""]);

/** LLMs sometimes return a one-element JSON array instead of an object. */
export function normalizeEnrichmentJsonRoot(raw: unknown): {
  value: unknown;
  unwrapArray?: boolean;
} {
  if (!Array.isArray(raw)) return { value: raw };
  const first = raw.find((entry) => entry != null && typeof entry === "object" && !Array.isArray(entry));
  if (first != null) return { value: first, unwrapArray: true };
  return { value: null, unwrapArray: true };
}

export function normaliseEnrichmentField(value: unknown): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || UNKNOWN.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function parseEnrichmentPayload(raw: unknown): {
  payload: EnrichmentPayload | null;
  error?: string;
  unwrapArray?: boolean;
} {
  const { value, unwrapArray } = normalizeEnrichmentJsonRoot(raw);
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {
      payload: null,
      error: unwrapArray ? "array_empty_or_invalid" : "payload_not_object",
      unwrapArray,
    };
  }
  const record = value as Record<string, unknown>;
  const payload: EnrichmentPayload = {
    country: normaliseEnrichmentField(record.country),
    city: normaliseEnrichmentField(record.city),
    stage: normaliseEnrichmentField(record.stage),
    problem: normaliseEnrichmentField(record.problem),
    sector: normaliseEnrichmentField(record.sector),
    organisation_name: normaliseEnrichmentField(record.organisation_name),
  };
  const hasAny = Object.values(payload).some((field) => field != null && field !== "");
  return {
    payload: hasAny ? payload : null,
    error: hasAny ? undefined : "all_unknown",
    unwrapArray,
  };
}

export function resolveEnrichmentSectorSlug(
  label: string | undefined,
  evidence: { title: string; summary: string; text: string },
): string | null {
  if (!label?.trim()) return null;
  const inferred = inferTaxonomyFromText({
    title: evidence.title,
    summary: evidence.summary,
    text: evidence.text,
  });
  const fromLabel = slugFromEnrichmentLabel(label, "sector");
  if (fromLabel && inferred.sectors.includes(fromLabel)) return fromLabel;
  if (fromLabel === "water" && !inferred.sectors.includes("water")) {
    return inferred.sectors[0] ?? null;
  }
  if (fromLabel && !inferred.sectors.includes(fromLabel)) {
    return inferred.sectors[0] ?? null;
  }
  return fromLabel;
}

export function resolveEnrichmentProblemSlug(
  label: string | undefined,
  evidence: { title: string; summary: string; text: string },
): string | null {
  if (!label?.trim()) return null;
  const inferred = inferTaxonomyFromText({
    title: evidence.title,
    summary: evidence.summary,
    text: evidence.text,
  });
  const fromLabel = slugFromEnrichmentLabel(label, "problem");
  if (fromLabel && inferred.problems.includes(fromLabel)) return fromLabel;
  return fromLabel && inferred.problems.length === 0 ? fromLabel : inferred.problems[0] ?? fromLabel;
}

export function slugFromEnrichmentLabel(label: string, kind: "sector" | "problem"): string | null {
  const norm = label.trim().toLowerCase();
  const catalogue = kind === "sector" ? SECTORS : PROBLEMS;
  for (const entry of catalogue) {
    if (entry.name.toLowerCase() === norm || entry.slug === norm.replace(/\s+/g, "-")) {
      return entry.slug;
    }
  }
  const inferred = inferTaxonomyFromText({ summary: label, text: label });
  const hits = kind === "sector" ? inferred.sectors : inferred.problems;
  return hits[0] ?? null;
}

export function parseEnrichmentMessageContent(content: string): {
  payload: EnrichmentPayload | null;
  error?: string;
  rawSample: string;
  unwrapArray?: boolean;
} {
  const rawSample = content.slice(0, 400);
  try {
    const parsed = JSON.parse(content) as unknown;
    const result = parseEnrichmentPayload(parsed);
    return { ...result, rawSample };
  } catch {
    return { payload: null, error: "json_parse_failed", rawSample };
  }
}
