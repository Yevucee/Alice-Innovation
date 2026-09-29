import { continentForCountryCode, countryCodeFor } from "./country-codes.js";

export interface ParsedPortfolioRegion {
  /** Display label for location facet (country name or macro-region). */
  locationLabel: string;
  continent: string | null;
  countryName: string | null;
  countryCode: string | null;
  sectorHint: string | null;
  rawRegion: string;
}

const CONTINENT_SLUG_TO_NAME: Record<string, string> = {
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  americas: "Americas",
  mena: "Middle East and North Africa",
  global: "Global",
};

export function continentNameForSlug(slug: string): string | null {
  return CONTINENT_SLUG_TO_NAME[slug.trim().toLowerCase()] ?? null;
}

export function continentSlugs(): string[] {
  return Object.keys(CONTINENT_SLUG_TO_NAME);
}

/** Seedstars-style labels: `AFRICA • HEALTHCARE`, `CENTRAL AND EASTERN EUROPE • EDUCATION`. */
export function parsePortfolioRegionLabel(label: string): ParsedPortfolioRegion {
  const rawRegion = label.replace(/&amp;/g, "&").trim();
  const parts = rawRegion.split("•").map((part) => part.trim());
  const regionPart = (parts[0] ?? "").trim();
  const sectorHint = parts[1]?.trim() || null;
  const upper = regionPart.toUpperCase();

  let continent: string | null = null;
  if (upper === "GLOBAL") continent = "Global";
  else if (upper.includes("MIDDLE EAST") || upper === "MENA") continent = "Middle East and North Africa";
  else if (upper.includes("AFRICA")) continent = "Africa";
  else if (upper.includes("ASIA") || upper.includes("PACIFIC")) continent = "Asia";
  else if (upper.includes("EUROPE")) continent = "Europe";
  else if (
    upper.includes("LATIN")
    || upper.includes("AMERICA")
    || upper.includes("CARIBBEAN")
  ) continent = "Americas";

  const directCode = countryCodeFor(regionPart);
  const countryName = directCode ? titleCaseCountry(regionPart) : null;
  if (directCode && !continent) {
    continent = continentForCountryCode(directCode);
  }

  const locationLabel = countryName ?? macroRegionDisplayName(regionPart, continent) ?? regionPart;

  return {
    locationLabel,
    continent,
    countryName,
    countryCode: directCode,
    sectorHint,
    rawRegion: rawRegion,
  };
}

function titleCaseCountry(value: string): string {
  return value.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function macroRegionDisplayName(regionPart: string, continent: string | null): string | null {
  if (!continent || continent === "Global") return continent;
  if (regionPart.toUpperCase() === continent.toUpperCase()) return continent;
  if (/^[A-Z\s]+$/.test(regionPart)) {
    return regionPart
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return continent;
}

export function continentNamesForFilter(slugs: string[]): string[] | null {
  if (!slugs.length) return null;
  return slugs
    .map((slug) => continentNameForSlug(slug))
    .filter((name): name is string => Boolean(name));
}
