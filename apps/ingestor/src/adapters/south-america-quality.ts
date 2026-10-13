import { load } from "cheerio";
import { normaliseName } from "@alice/shared";
import { isBoilerplateCatalogueTitle } from "./catalogue-parse-helpers.js";
import { IngestQualityDropError } from "../ingest-quality-drop.js";

export const SOUTH_AMERICA_ADAPTER_IDS = new Set([
  "fapesp-pipe",
  "uc-chile-technologies",
  "premios-verdes-500",
  "gridx-portfolio",
  "unc-oferta-tecnologica",
  "cuech-red-proyectos",
  "usp-vitrine-portfolio",
]);

export const FAPESP_TITLE_PREFIX_RE = /^Pesquisa e Inovação:\s*/i;

export const SOUTH_AMERICA_COUNTRY_NAMES = new Set([
  "argentina",
  "bolivia",
  "brazil",
  "brasil",
  "chile",
  "colombia",
  "ecuador",
  "paraguay",
  "peru",
  "perú",
  "uruguay",
  "venezuela",
  "guyana",
  "suriname",
]);

export const LISTING_EXCERPT_RE = /\[\s*…\s*\]\s*$|…\s*$/;

const MIN_DESCRIPTION_CHARS = 150;
const MIN_SENTENCE_MARKERS = 2;

export function stripFapespTitlePrefix(title: string): string {
  return title.replace(FAPESP_TITLE_PREFIX_RE, "").trim();
}

export function isListingExcerptDescription(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (LISTING_EXCERPT_RE.test(trimmed)) return true;
  if (trimmed.endsWith("…") || trimmed.endsWith("...")) return true;
  return false;
}

export function sentenceCount(text: string): number {
  const parts = text.split(/[.!?]+/).map((part) => part.trim()).filter((part) => part.length > 12);
  return parts.length;
}

export function meetsSouthAmericaDescriptionGate(text: string): boolean {
  const body = text.replace(/\s+/g, " ").trim();
  if (body.length < MIN_DESCRIPTION_CHARS) return false;
  if (sentenceCount(body) < MIN_SENTENCE_MARKERS) return false;
  return true;
}

/** VC portfolio blurbs are often one sentence; append catalogue context before the quality gate. */
export function enrichSouthAmericaPortfolioDescription(
  description: string,
  context: { countryName?: string | null; catalogueLabel: string },
): string {
  const body = description.replace(/\s+/g, " ").trim();
  if (!body) return body;
  if (meetsSouthAmericaDescriptionGate(body)) return body;
  const country = context.countryName?.trim();
  const suffix = country
    ? `The organisation is based in ${country}. It is listed in the ${context.catalogueLabel} for Latin American innovation and technology transfer.`
    : `It is listed in the ${context.catalogueLabel} for Latin American innovation and technology transfer.`;
  const combined = `${body.replace(/\.\s*$/, "")}. ${suffix}`;
  return combined.replace(/\s+/g, " ").trim();
}

export function isSouthAmericaCountryLabel(countryLabel: string): boolean {
  const key = normaliseName(countryLabel);
  return SOUTH_AMERICA_COUNTRY_NAMES.has(key) || key === "peru";
}

export function assertSouthAmericaOrganisationTitle(title: string): void {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new IngestQualityDropError(["empty_title"]);
  if (isBoilerplateCatalogueTitle(trimmed)) throw new IngestQualityDropError(["blocklist_title"]);
  if (trimmed.length < 3) throw new IngestQualityDropError(["truncated_title"]);
}

export function assertSouthAmericaTitle(title: string): void {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new IngestQualityDropError(["empty_title"]);
  if (isBoilerplateCatalogueTitle(trimmed)) throw new IngestQualityDropError(["blocklist_title"]);
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) throw new IngestQualityDropError(["truncated_title"]);
  if (trimmed.length < 4) throw new IngestQualityDropError(["truncated_title"]);
  const lastWord = words[words.length - 1] ?? "";
  if (lastWord.length <= 1 && trimmed.length < 30) {
    throw new IngestQualityDropError(["truncated_title"]);
  }
}

export function assertSouthAmericaDescription(description: string, context: "detail" | "listing"): void {
  const body = description.replace(/\s+/g, " ").trim();
  if (!body) throw new IngestQualityDropError(["short_description"]);
  if (context === "listing" && isListingExcerptDescription(body)) {
    throw new IngestQualityDropError(["listing_excerpt"]);
  }
  if (!meetsSouthAmericaDescriptionGate(body)) {
    throw new IngestQualityDropError(["short_description"]);
  }
}

export function contentFingerprint(title: string, description: string): string {
  const t = normaliseName(title).toLowerCase();
  const d = description.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 400);
  return `${t}|${d}`;
}

export function parseSouthAmericaCountryFromLocation(locationLine: string): string | null {
  const normalised = locationLine.replace(/\s+/g, " ").trim();
  if (!normalised) return null;
  const beforeDot = normalised.split("·")[0]?.trim() ?? normalised;
  const beforeComma = beforeDot.split(",")[0]?.trim() ?? beforeDot;
  const candidate = beforeComma.toLowerCase();
  for (const country of SOUTH_AMERICA_COUNTRY_NAMES) {
    if (candidate === country || candidate.startsWith(`${country} `)) {
      if (country === "brasil") return "Brazil";
      if (country === "perú") return "Peru";
      return beforeComma.charAt(0).toUpperCase() + beforeComma.slice(1).toLowerCase();
    }
  }
  return null;
}

export function isPremiosSouthAmericaCountry(countryName: string | null): boolean {
  if (!countryName) return false;
  const key = countryName.trim().toLowerCase();
  return SOUTH_AMERICA_COUNTRY_NAMES.has(key) || key === "peru";
}

/** Strip personal contact fields from Premios Verdes detail HTML before text extraction. */
export function stripPersonalContactHtml(html: string): string {
  const $ = load(html);
  $(".contacto, .contact, .whatsapp, .redes-sociales").remove();
  $("a[href^='mailto:'], a[href^='tel:']").remove();
  const text = $.root().html() ?? html;
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "");
}

export function assertDiscoverNonEmpty(sourceId: string, refs: { externalId?: string; url: string }[]): void {
  if (refs.length === 0) {
    throw new Error(
      `south_america_zero_discover:${sourceId}: listing returned 0 items (HTML structure may have changed or page needs JavaScript)`,
    );
  }
}

export function dedupeDiscoveredRefs<T extends { url: string; externalId?: string }>(
  refs: T[],
  fingerprints?: Set<string>,
): T[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const out: T[] = [];
  for (const ref of refs) {
    const idKey = ref.externalId?.trim() || ref.url;
    if (seenIds.has(idKey) || seenUrls.has(ref.url)) continue;
    seenIds.add(idKey);
    seenUrls.add(ref.url);
    out.push(ref);
  }
  return out;
}

export function premiosIncludeCentralAmerica(sourceNotes: string): boolean {
  return /\binclude_central_america:\s*true\b/i.test(sourceNotes);
}
