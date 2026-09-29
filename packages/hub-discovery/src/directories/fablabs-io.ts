import { AFRICA_COUNTRY_CODES } from "../africa-countries.js";
import type { DiscoveredHub, HubDirectoryAdapter } from "../types.js";

interface FabLabRecord {
  id: number;
  name: string;
  slug: string;
  kind_name?: string;
  city?: string | null;
  country_code?: string | null;
  links?: Array<{ url: string }>;
}

export const fablabsIoDirectory: HubDirectoryAdapter = {
  slug: "fablabs-io",
  async discover(ctx): Promise<DiscoveredHub[]> {
    const response = await ctx.fetchText("https://www.fablabs.io/api/labs");
    if (response.status >= 400) return [];
    const labs = JSON.parse(response.body) as FabLabRecord[];
    const hubs: DiscoveredHub[] = [];
    for (const lab of labs) {
      const code = (lab.country_code ?? "").toUpperCase();
      if (!AFRICA_COUNTRY_CODES.has(code)) continue;
      const website = lab.links?.[0]?.url ?? null;
      hubs.push({
        name: lab.name,
        country: code,
        city: lab.city ?? null,
        hubSubtype: "FABLAB",
        website,
        externalId: lab.slug || String(lab.id),
        directoryProfileUrl: `https://www.fablabs.io/labs/${lab.slug}`,
        networks: [{ networkSlug: "fablabs-io", memberRef: lab.slug }],
        raw: { id: lab.id, kind_name: lab.kind_name, country_code: code },
      });
      if (ctx.limit !== null && ctx.limit !== undefined && hubs.length >= ctx.limit) break;
    }
    return hubs;
  },
};
