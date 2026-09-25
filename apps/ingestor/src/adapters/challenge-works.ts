import { load } from "cheerio";
import { htmlToText } from "@alice/shared";
import { buildDraft, ogImageFromPage } from "./draft.js";
import { defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";
import type { NormalisedDraft } from "@alice/shared";

const PRIZE_PATH = /^\/challenge-prizes\/[a-z0-9-]+\/?$/i;
const EXPLORE_BASE = "https://challengeworks.org/about-challenge-prizes/explore-prizes/";

export function parseChallengeWorksListing(html: string): Array<{ url: string; externalId: string }> {
  const $ = load(html);
  const refs = new Map<string, string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    let path = href;
    try {
      path = href.startsWith("http") ? new URL(href).pathname : path;
    } catch {
      return;
    }
    if (!PRIZE_PATH.test(path)) return;
    const slug = path.split("/").filter(Boolean).pop() ?? path;
    const url = new URL(path, "https://challengeworks.org").toString().replace(/\/$/, "") + "/";
    refs.set(url, slug);
  });
  return [...refs.entries()].map(([url, externalId]) => ({ url, externalId }));
}

export function parseChallengeWorks(page: FetchedPage): NormalisedDraft {
  const $ = load(page.html);
  const title = $("meta[property='og:title']").attr("content")
    ?.replace(/\s*-\s*Challenge Works.*$/i, "")
    .trim()
    || $("title").text().replace(/\s*-\s*Challenge Works.*$/i, "").trim();
  if (!title) throw new Error(`Challenge Works page has no title: ${page.url}`);
  const summary = $("meta[property='og:description']").attr("content")?.trim()
    || $("meta[name='description']").attr("content")?.trim()
    || "";
  const mainText = htmlToText($("main").html() ?? "").slice(0, 4000);
  const slug = page.url.split("/").filter(Boolean).pop() ?? page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId: slug,
    summary: summary || title,
    text: mainText || summary,
    resourceType: "PROGRAMME",
    evidenceBasis: "PROGRAMME_SELECTED",
    evidenceStage: "UNKNOWN",
    imageUrl: ogImageFromPage(page.html, page.finalUrl || page.url),
    rawMetadata: { listing_only: page.listingOnly },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const challengeWorksAdapter: SourceAdapter = {
  id: "challenge-works",
  fullCatalogue: true,
  async discover(ctx) {
    const merged = new Map<string, { url: string; externalId: string }>();
    for (let page = 1; page <= 15; page += 1) {
      const url = page === 1 ? EXPLORE_BASE : `${EXPLORE_BASE}page/${page}/`;
      try {
        const listing = await ctx.fetchText(url);
        for (const ref of parseChallengeWorksListing(listing.body)) {
          if (!merged.has(ref.url)) merged.set(ref.url, ref);
        }
      } catch {
        break;
      }
    }
    return [...merged.values()].sort((a, b) => a.url.localeCompare(b.url));
  },
  fetch: defaultFetch,
  parse: parseChallengeWorks,
};
