/** ISO 3166-1 alpha-2 codes for African states (+ Western Sahara). */
export const AFRICA_COUNTRY_CODES: readonly string[] = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ",
  "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG",
  "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO",
  "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "EH", "ZM", "ZW",
];

export function isAfricanCountryCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return AFRICA_COUNTRY_CODES.includes(code.trim().toUpperCase());
}

/**
 * When catalogue pages omit country, apply hub/programme geography so search facets work.
 * Pan-African portfolios use continent-only; single-country hubs get a default country.
 */
export const AFRICA_SOURCE_GEO_DEFAULTS: Record<string, { countryName?: string; continentName: string }> = {
  "startgate-um6p": { countryName: "Morocco", continentName: "Africa" },
  "ghana-climate-innovation-centre": { countryName: "Ghana", continentName: "Africa" },
  "kosmos-innovation-centre-ghana": { countryName: "Ghana", continentName: "Africa" },
  "ventures-platform": { continentName: "Africa" },
  "cchub-syndicate": { countryName: "Nigeria", continentName: "Africa" },
  "ihub-future-of-learning": { countryName: "Kenya", continentName: "Africa" },
  "oceanhub-africa": { countryName: "South Africa", continentName: "Africa" },
  "su-launchlab": { countryName: "South Africa", continentName: "Africa" },
  "norrsken-accelerator": { countryName: "Rwanda", continentName: "Africa" },
  "digital-africa": { continentName: "Africa" },
  "founders-factory-africa": { continentName: "Africa" },
  "baobab-network": { continentName: "Africa" },
  "africa-tech-festival-startup-hub": { continentName: "Africa" },
  "norrsken-100": { continentName: "Africa" },
  "injini-african-edtech-map": { continentName: "Africa" },
};
