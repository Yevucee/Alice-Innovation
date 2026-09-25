import { buildDraft, evidenceFromTrl, findObject, imageFromUnknown, sitemapLocs, stringField } from "./draft.js";
import { defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

const SOLUTION_PATH = "/solutions/solutions-explorer/portfolio/solutions/";

export function parseSolarImpulse(page: FetchedPage): NormalisedDraft {
  const match = page.html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Solar Impulse page has no ng-state payload: ${page.finalUrl}`);
  }
  const payload = JSON.parse(match[1]) as unknown;
  const solution = findObject(
    payload,
    (record) => record.type === "solution" && typeof record.short_name === "string",
  );
  if (!solution) throw new Error(`Solar Impulse ng-state has no solution: ${page.finalUrl}`);
  const company = solution.company && typeof solution.company === "object"
    ? (solution.company as Record<string, unknown>)
    : null;
  const sectors = Array.isArray(solution.sectors)
    ? solution.sectors.map((sector) => stringField(sector)).filter((name): name is string => Boolean(name))
    : [];
  const maturity = typeof solution.maturity === "string" ? solution.maturity : null;
  const summary = typeof solution.one_sentence_description === "string" ? solution.one_sentence_description : "";
  const supporting = typeof solution.supporting === "string" ? solution.supporting : summary;
  const pageUrl = page.finalUrl || page.url;
  const imageUrl = [solution.image, solution.picture, solution.logo, solution.photo, solution.thumbnail]
    .map((candidate) => imageFromUnknown(pageUrl, candidate))
    .find((url): url is string => Boolean(url))
    ?? imageFromUnknown(pageUrl, company?.logo ?? company?.image);
  return buildDraft({
    title: String(solution.short_name),
    url: page.finalUrl || page.url,
    externalId: String(solution.id ?? solution.slug ?? page.url),
    summary,
    text: supporting,
    resourceType: "SOLUTION",
    organisationName: company ? stringField(company.name) ?? stringField(company) : null,
    countryName: company ? stringField(company.country) : null,
    tags: sectors,
    evidenceStage: evidenceFromTrl(maturity),
    evidenceBasis: solution.is_labeled === true ? "INDEPENDENT_ASSESSMENT" : "UNKNOWN",
    maturityStage: maturity ?? "UNKNOWN",
    imageUrl,
    rawMetadata: {
      slug: solution.slug ?? null,
      labeled: solution.is_labeled === true,
      sectors,
      listing_only: page.listingOnly,
    },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const solarImpulseAdapter: SourceAdapter = {
  id: "solar-impulse",
  fullCatalogue: true,
  async discover(ctx) {
    const sitemapUrl = ctx.source.discovery.sitemap;
    if (!sitemapUrl) return [];
    const sitemap = await ctx.fetchText(sitemapUrl);
    const locs = sitemapLocs(sitemap.body);
    const nested = locs.filter((url) => url.endsWith(".xml"));
    const pages = locs.filter((url) => url.includes(SOLUTION_PATH) && !url.includes("/fr/"));
    for (const child of nested.slice(0, 5)) {
      const extra = await ctx.fetchText(child);
      pages.push(...sitemapLocs(extra.body).filter((url) => url.includes(SOLUTION_PATH) && !url.includes("/fr/")));
    }
    return [...new Set(pages)].sort().map((url) => ({ url, externalId: url.split("/").pop() }));
  },
  fetch: defaultFetch,
  parse: parseSolarImpulse,
};
