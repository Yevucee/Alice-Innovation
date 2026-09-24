import { asEvidenceBasis, asEvidenceStage, asResourceType, canonicaliseUrl, truncate, type NormalisedDraft, type ResourceType } from "@alice/shared";
import { countryCodeFor } from "@alice/taxonomy";

export function buildDraft(input: {
  title: string;
  url: string;
  externalId: string;
  summary?: string;
  text?: string;
  resourceType?: ResourceType;
  organisationName?: string | null;
  personName?: string | null;
  countryName?: string | null;
  tags?: string[];
  evidenceStage?: string;
  evidenceBasis?: string;
  maturityStage?: string;
  publishedAt?: string | null;
  imageUrl?: string | null;
  language?: string;
  rawMetadata?: Record<string, unknown>;
  etag?: string | null;
  lastModified?: string | null;
}): NormalisedDraft {
  const canonicalUrl = canonicaliseUrl(input.url);
  const summary = truncate(input.summary ?? "", 500);
  const countryName = input.countryName ?? null;
  return {
    resourceType: asResourceType(input.resourceType),
    title: truncate(input.title, 300),
    sourceSummary: summary,
    extractedText: truncate(input.text || summary, 1500),
    externalId: input.externalId,
    canonicalUrl,
    originalUrl: input.url,
    language: input.language ?? "en",
    imageUrl: input.imageUrl ?? null,
    publishedAt: input.publishedAt ?? null,
    organisationName: input.organisationName ?? null,
    personName: input.personName ?? null,
    countryName,
    countryCode: countryCodeFor(countryName),
    tags: input.tags ?? [],
    evidenceStage: asEvidenceStage(input.evidenceStage),
    evidenceBasis: asEvidenceBasis(input.evidenceBasis),
    maturityStage: input.maturityStage?.slice(0, 120) || "UNKNOWN",
    costLevel: "UNKNOWN",
    commercialStatus: "UNKNOWN",
    rawMetadata: input.rawMetadata ?? {},
    etag: input.etag ?? null,
    lastModified: input.lastModified ?? null,
  };
}

export function evidenceFromTrl(maturity: string | null | undefined): string {
  const match = maturity?.match(/TRL\s*(\d+)/i);
  if (!match) return "UNKNOWN";
  const level = Number(match[1]);
  if (level <= 3) return "IDEA";
  if (level <= 6) return "PROTOTYPE";
  if (level <= 8) return "PILOT";
  return "DEPLOYED";
}

export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => decodeURIComponent(match[1]));
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function findObject(root: unknown, predicate: (value: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const record = asRecord(current);
    if (record) {
      if (predicate(record)) return record;
      stack.push(...Object.values(record));
    } else if (Array.isArray(current)) {
      stack.push(...current);
    }
  }
  return null;
}

export function stringField(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = asRecord(value);
  if (record && typeof record.name === "string") return record.name.trim();
  return null;
}
