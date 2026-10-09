import { load } from "cheerio";
import { asEvidenceBasis, asEvidenceStage, asResourceType, canonicaliseUrl, tryCanonicaliseUrl, truncate, type NormalisedDraft, type ResourceType } from "@alice/shared";
import { countryCodeFor } from "@alice/taxonomy";

export function isUsableImageUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith("data:")) return false;
  return true;
}

export function absoluteImageUrl(pageUrl: string, imageUrl: string | undefined | null): string | null {
  if (!isUsableImageUrl(imageUrl)) return null;
  try {
    return new URL(imageUrl!.trim(), pageUrl).toString();
  } catch {
    return null;
  }
}

export function imageFromUnknown(pageUrl: string, value: unknown): string | null {
  if (typeof value === "string") return absoluteImageUrl(pageUrl, value);
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["url", "src", "path", "href", "default", "large", "medium"]) {
    const nested = record[key];
    if (typeof nested === "string") {
      const resolved = absoluteImageUrl(pageUrl, nested);
      if (resolved) return resolved;
    }
  }
  return null;
}

export function ogImageFromPage(html: string, pageUrl: string): string | null {
  const $ = load(html);
  const candidate = $("meta[property='og:image']").attr("content")
    || $("meta[name='twitter:image']").attr("content")
    || $("meta[property='twitter:image']").attr("content");
  const fromMeta = absoluteImageUrl(pageUrl, candidate);
  if (fromMeta) return fromMeta;

  for (const jsonLd of jsonLdImageCandidates(html)) {
    const resolved = absoluteImageUrl(pageUrl, jsonLd);
    if (resolved) return resolved;
  }

  const articleImg = $("article img[src], main img[src], .entry-content img[src]").first().attr("src");
  return absoluteImageUrl(pageUrl, articleImg);
}

/** og/twitter meta, JSON-LD logo/image, then first article/main img. */
export function resolvePageImageUrl(html: string, pageUrl: string): string | null {
  return ogImageFromPage(html, pageUrl);
}

function jsonLdImageCandidates(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectJsonLdImages(JSON.parse(match[1]) as unknown, urls);
    } catch {
      /* ignore */
    }
  }
  return urls;
}

function collectJsonLdImages(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const entry of node) collectJsonLdImages(entry, out);
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  for (const key of ["image", "logo", "thumbnailUrl", "contentUrl"]) {
    pushJsonLdImage(record[key], out);
  }
  if (record["@graph"]) collectJsonLdImages(record["@graph"], out);
  if (record.mainEntity) collectJsonLdImages(record.mainEntity, out);
}

function pushJsonLdImage(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) pushJsonLdImage(entry, out);
    return;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string" && record.url.trim()) out.push(record.url.trim());
    else if (typeof record.contentUrl === "string" && record.contentUrl.trim()) out.push(record.contentUrl.trim());
  }
}

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
  continentName?: string | null;
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
  const canonicalUrl = tryCanonicaliseUrl(input.url);
  if (!canonicalUrl) {
    throw new Error(`Cannot canonicalise URL: ${input.url}`);
  }
  let imageUrl = input.imageUrl ?? null;
  if (imageUrl) {
    imageUrl = tryCanonicaliseUrl(imageUrl) ?? null;
  }
  const summary = truncate(input.summary ?? "", 500);
  const countryName = input.countryName ?? null;
  const continentName = input.continentName ?? null;
  return {
    resourceType: asResourceType(input.resourceType),
    title: truncate(input.title, 300),
    sourceSummary: summary,
    extractedText: truncate(input.text || summary, 1500),
    externalId: input.externalId,
    canonicalUrl,
    originalUrl: input.url,
    language: input.language ?? "en",
    imageUrl,
    publishedAt: input.publishedAt ?? null,
    organisationName: input.organisationName ?? null,
    personName: input.personName ?? null,
    countryName,
    countryCode: countryCodeFor(countryName),
    continentName,
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
