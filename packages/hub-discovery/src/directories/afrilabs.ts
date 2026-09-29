import type { HubDirectoryAdapter, DiscoveredHub, DiscoveryContext } from "../types.js";
import { countryNameFromAfriLabsClass, hubSubtypeFromAfriLabsClass } from "../africa-countries.js";

interface AfriLabsHub {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  class_list?: string[];
  content?: { rendered: string };
}

export const afrilabsDirectory: HubDirectoryAdapter = {
  slug: "afrilabs",
  async discover(ctx: DiscoveryContext): Promise<DiscoveredHub[]> {
    const hubs: DiscoveredHub[] = [];
    let page = 1;
    while (true) {
      const url = `https://www.afrilabs.com/wp-json/wp/v2/hub?per_page=100&page=${page}`;
      const response = await ctx.fetchText(url);
      if (response.status === 400 || response.status === 404) break;
      let batch: AfriLabsHub[];
      try {
        batch = JSON.parse(response.body) as AfriLabsHub[];
      } catch {
        break;
      }
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const item of batch) {
        const classList = item.class_list ?? [];
        const country = countryNameFromAfriLabsClass(classList);
        hubs.push({
          name: item.title.rendered.replace(/\s+/g, " ").trim(),
          country,
          hubSubtype: hubSubtypeFromAfriLabsClass(classList),
          externalId: item.slug || String(item.id),
          directoryProfileUrl: item.link,
          description: stripHtml(item.content?.rendered ?? "").slice(0, 500),
          networks: [{ networkSlug: "afrilabs", memberRef: item.slug }],
          raw: { id: item.id, class_list: classList },
        });
        if (ctx.limit !== null && ctx.limit !== undefined && hubs.length >= ctx.limit) {
          return hubs;
        }
      }
      page += 1;
      if (batch.length < 100) break;
    }
    return hubs;
  },
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
