export interface TaxonomyNode {
  slug: string;
  name: string;
  parentSlug?: string;
}

export const PROBLEMS: TaxonomyNode[] = [
  { slug: "water", name: "Water" },
  { slug: "agricultural-water", name: "Agricultural water", parentSlug: "water" },
  { slug: "irrigation", name: "Irrigation", parentSlug: "agricultural-water" },
  { slug: "drinking-water", name: "Drinking water", parentSlug: "water" },
  { slug: "wastewater", name: "Wastewater", parentSlug: "water" },
  { slug: "food-loss", name: "Food loss" },
  { slug: "energy-access", name: "Energy access" },
  { slug: "cold-chain", name: "Cold chain" },
  { slug: "flooding", name: "Flooding" },
  { slug: "waste-management", name: "Waste management" },
  { slug: "healthcare-access", name: "Healthcare access" },
  { slug: "education-access", name: "Education access" },
  { slug: "financial-inclusion", name: "Financial inclusion" },
  { slug: "biodiversity-loss", name: "Biodiversity loss" },
];

export const SECTORS: TaxonomyNode[] = [
  { slug: "agriculture", name: "Agriculture" },
  { slug: "water", name: "Water" },
  { slug: "energy", name: "Energy" },
  { slug: "food", name: "Food" },
  { slug: "climate", name: "Climate" },
  { slug: "health", name: "Health" },
  { slug: "education", name: "Education" },
  { slug: "waste", name: "Waste" },
  { slug: "biodiversity", name: "Biodiversity" },
  { slug: "finance", name: "Finance" },
  { slug: "government", name: "Government" },
  { slug: "community-development", name: "Community development" },
];

export const TECHNOLOGIES: TaxonomyNode[] = [
  { slug: "solar", name: "Solar" },
  { slug: "gravity-fed", name: "Gravity-fed distribution" },
  { slug: "heat-pump", name: "Heat pump" },
  { slug: "filtration", name: "Filtration" },
  { slug: "drip-irrigation", name: "Drip irrigation" },
  { slug: "evaporative-cooling", name: "Evaporative cooling" },
  { slug: "recycling", name: "Recycling" },
  { slug: "sensors", name: "Sensors" },
  { slug: "mobile-technology", name: "Mobile technology" },
];

/** Known country names only. Unknown names stay unresolved rather than guessed. */
export const COUNTRY_CODES: Record<string, string> = {
  ghana: "GH",
  kenya: "KE",
  nigeria: "NG",
  "south africa": "ZA",
  rwanda: "RW",
  senegal: "SN",
  uganda: "UG",
  tanzania: "TZ",
  ethiopia: "ET",
  india: "IN",
  bangladesh: "BD",
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  "united kingdom": "GB",
  uk: "GB",
  france: "FR",
  germany: "DE",
  netherlands: "NL",
  brazil: "BR",
  mexico: "MX",
  canada: "CA",
  australia: "AU",
  china: "CN",
  japan: "JP",
};

export function countryCodeFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return COUNTRY_CODES[key] ?? null;
}
