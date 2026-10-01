import { continentForCountryCode, countryCodeFor, COUNTRY_CODES } from "./country-codes.js";

export interface InferredLocation {
  countryName: string | null;
  countryCode: string | null;
  city: string | null;
}

const CITY_COUNTRY = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,40}),\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'()-]{2,60})/g;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCaseCountry(value: string): string {
  return value.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function sortedCountryEntries(): Array<[string, string]> {
  return Object.entries(COUNTRY_CODES).sort((a, b) => b[0].length - a[0].length);
}

/** Extract a known country from free text (e.g. "Archidona, Ecuador"). */
export function inferCountryFromText(text: string): InferredLocation {
  if (!text?.trim()) {
    return { countryName: null, countryCode: null, city: null };
  }

  for (const match of text.matchAll(CITY_COUNTRY)) {
    const city = match[1]?.trim() ?? null;
    const countryPart = (match[2]?.trim() ?? "").replace(/[.,;:]+$/, "");
    const code = countryCodeFor(countryPart);
    if (code) {
      void continentForCountryCode(code);
      return {
        countryName: titleCaseCountry(countryPart),
        countryCode: code,
        city,
      };
    }
  }

  const lower = text.toLowerCase();
  for (const [name, code] of sortedCountryEntries()) {
    const pattern = new RegExp(`(?:^|[^a-z])${escapeRegex(name)}(?:[^a-z]|$)`, "i");
    if (pattern.test(lower)) {
      return {
        countryName: titleCaseCountry(name),
        countryCode: code,
        city: null,
      };
    }
  }

  return { countryName: null, countryCode: null, city: null };
}
