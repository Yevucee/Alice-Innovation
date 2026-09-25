import { load } from "cheerio";
import { buildDraft, ogImageFromPage, sitemapLocs } from "./draft.js";
import { defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

export function parseMitSolve(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) throw new Error(`MIT Solve page has no title: ${page.url}`);
  const summary = $(".mt-8").first().text().replace(/\s+/g, " ").trim();
  const answers = new Map<string, string>();
  $("div").each((_, element) => {
    const question = $(element).find(".font-semibold").first().text().replace(/\s+/g, " ").trim();
    const answer = $(element).find(".text-18, .lg\\:text-20").first().text().replace(/\s+/g, " ").trim();
    if (question && answer) answers.set(question.toLowerCase(), answer);
  });
  const organisation = [...answers.entries()].find(([question]) => question.includes("organization"))?.[1] ?? null;
  const headquarters = [...answers.entries()].find(([question]) => question.includes("headquartered"))?.[1] ?? null;
  const person = $(".font-bold")
    .filter((_, element) => $(element).text().trim().toLowerCase() === "team leader")
    .first()
    .parent()
    .find(".text-28")
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const idMatch = page.url.match(/\/solutions\/(\d+)/);
  const paragraphs = $("div.text-18, div.lg\\:text-20")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 40)
    .slice(0, 4)
    .join(" ");
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId: idMatch?.[1] ?? page.url,
    summary: summary || title,
    text: paragraphs || summary,
    resourceType: "SOLUTION",
    organisationName: organisation,
    personName: person || null,
    countryName: headquarters,
    imageUrl: ogImageFromPage(page.html, page.finalUrl || page.url),
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { headquarters, listing_only: page.listingOnly },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const mitSolveAdapter: SourceAdapter = {
  id: "mit-solve",
  fullCatalogue: true,
  async discover(ctx) {
    const sitemapUrl = ctx.source.discovery.sitemap ?? "https://solve.mit.edu/sitemap.xml";
    const sitemap = await ctx.fetchText(sitemapUrl);
    let locs = sitemapLocs(sitemap.body);
    const indexes = locs.filter((url) => url.endsWith(".xml"));
    for (const child of indexes.slice(0, 8)) {
      const extra = await ctx.fetchText(child);
      locs = locs.concat(sitemapLocs(extra.body));
    }
    return [...new Set(locs)]
      .filter((url) => /\/solutions\/\d+\/?$/.test(url))
      .sort()
      .map((url) => ({ url, externalId: url.match(/(\d+)\/?$/)?.[1] }));
  },
  fetch: defaultFetch,
  parse: parseMitSolve,
};
