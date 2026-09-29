import type { CatalogueCapability } from "@alice/database";
import { canonicaliseUrl } from "@alice/shared";
import * as cheerio from "cheerio";
import type { DiscoveryContext } from "./types.js";

const CATALOGUE_HINTS = [
  { pattern: /portfolio|startups|companies|ventures|alumni|cohort|directory|showcase|case-stud/i, capability: "PORTFOLIO" as CatalogueCapability },
  { pattern: /startup-directory|founders|innovators-map/i, capability: "STARTUP_DIRECTORY" as CatalogueCapability },
  { pattern: /challenge|prize|competition/i, capability: "CHALLENGE_SHOWCASE" as CatalogueCapability },
  { pattern: /programme|program|accelerator|incubat/i, capability: "PROGRAMME_COHORT" as CatalogueCapability },
  { pattern: /case-stud/i, capability: "CASE_STUDIES" as CatalogueCapability },
];

export async function probeCatalogueCapability(
  ctx: DiscoveryContext,
  homepage: string,
): Promise<{ capability: CatalogueCapability; collectionUrl: string | null; notes: string }> {
  try {
    const page = await ctx.fetchText(canonicaliseUrl(homepage));
    if (page.status >= 400) {
      return { capability: "UNKNOWN", collectionUrl: null, notes: `homepage_http_${page.status}` };
    }
    const $ = cheerio.load(page.body);
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.push(href);
    });
    let best: CatalogueCapability = "NONE";
    let collectionUrl: string | null = null;
    for (const link of links) {
      try {
        const url = new URL(link, page.finalUrl || homepage);
        if (url.hostname.replace(/^www\./, "") !== new URL(homepage).hostname.replace(/^www\./, "")) {
          continue;
        }
        const path = `${url.pathname}${url.search}`;
        for (const hint of CATALOGUE_HINTS) {
          if (hint.pattern.test(path)) {
            if (best === "NONE" || best === "UNKNOWN") {
              best = hint.capability;
              collectionUrl = url.toString().replace(/\/$/, "");
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (best !== "NONE") return { capability: best, collectionUrl, notes: "link_heuristic" };
    const text = page.body.toLowerCase();
    if (text.includes("portfolio") || text.includes("our startups")) {
      return { capability: "MIXED", collectionUrl: null, notes: "body_keyword" };
    }
    return { capability: "NONE", collectionUrl: null, notes: "no_catalogue_links" };
  } catch (error) {
    return {
      capability: "UNKNOWN",
      collectionUrl: null,
      notes: error instanceof Error ? error.message : String(error),
    };
  }
}
