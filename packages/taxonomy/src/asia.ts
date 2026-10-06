/**
 * When catalogue pages omit country, apply hub/programme geography so search facets work.
 * Pan-Asian portfolios use continent-only; single-country hubs get a default country.
 */
export const ASIA_SOURCE_GEO_DEFAULTS: Record<string, { countryName?: string; continentName: string }> = {
  "sginnovate-portfolio": { countryName: "Singapore", continentName: "Asia" },
  "open-innovation-network-singapore": { countryName: "Singapore", continentName: "Asia" },
  "hkstp-company-directory": { countryName: "Hong Kong", continentName: "Asia" },
  "hub71-startup-directory": { countryName: "United Arab Emirates", continentName: "Asia" },
  "astana-hub-company-network": { countryName: "Kazakhstan", continentName: "Asia" },
  "startup-thailand-ecosystem": { countryName: "Thailand", continentName: "Asia" },
  "startup-bangladesh-portfolio": { countryName: "Bangladesh", continentName: "Asia" },
  "j-startup": { countryName: "Japan", continentName: "Asia" },
  "dcamp-startup-directory": { countryName: "South Korea", continentName: "Asia" },
  "findit-taiwan": { countryName: "Taiwan", continentName: "Asia" },
  "ccamp": { countryName: "India", continentName: "Asia" },
  "birac-technology-portal": { countryName: "India", continentName: "Asia" },
};
