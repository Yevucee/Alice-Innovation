/** ISO 3166-1 alpha-2 codes for African states + Western Sahara. */
export const AFRICA_COUNTRY_CODES = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ",
  "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG",
  "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO",
  "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "EH", "ZM", "ZW",
]);

export function countryNameFromAfriLabsClass(classList: string[]): string | null {
  const tag = classList.find((item) => item.startsWith("hub_country-"));
  if (!tag) return null;
  const slug = tag.replace("hub_country-", "");
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function hubSubtypeFromAfriLabsClass(classList: string[]): import("@alice/database").HubSubtype {
  if (classList.some((c) => c.includes("fab"))) return "FABLAB";
  if (classList.some((c) => c.includes("makerspace"))) return "MAKERSPACE";
  if (classList.some((c) => c.includes("incubator"))) return "INCUBATOR";
  if (classList.some((c) => c.includes("accelerator"))) return "ACCELERATOR";
  if (classList.some((c) => c.includes("university"))) return "UNIVERSITY_INNOVATION_CENTRE";
  if (classList.some((c) => c.includes("innovation-centre") || c.includes("co-working"))) {
    return "INNOVATION_HUB";
  }
  return "INNOVATION_HUB";
}
