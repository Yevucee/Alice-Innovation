import { load } from "cheerio";
import { buildDraft } from "./draft.js";
import { AccessBlockedError, defaultFetch, type FetchedPage, type SourceAdapter } from "./types.js";
import { HttpStatusError } from "../http.js";

/**
 * Parser for a solutions-library article. Live pages could not be sampled:
 * engineeringforchange.org answers this client with a Cloudflare bot check.
 * The selectors stay conservative (title, summary, description) so a later
 * legitimate HTML sample can tighten them without changing the pipeline.
 */
export function parseEngineeringForChange(page: FetchedPage): ReturnType<typeof buildDraft> {
  const $ = load(page.html);
  const title = $("h1").first().text().replace(/\s+/g, " ").trim()
    || $("meta[property='og:title']").attr("content")
    || "";
  if (!title) throw new Error(`Engineering for Change page has no title: ${page.url}`);
  const summary = $("p.summary").first().text().replace(/\s+/g, " ").trim()
    || $("meta[name='description']").attr("content")
    || "";
  const slug = page.url.split("/").filter(Boolean).pop() ?? page.url;
  return buildDraft({
    title,
    url: page.finalUrl || page.url,
    externalId: slug,
    summary,
    text: summary,
    resourceType: "SOLUTION",
    evidenceBasis: "EDITORIALLY_CURATED",
    evidenceStage: "UNKNOWN",
    rawMetadata: { listing_only: page.listingOnly, parser: "provisional" },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

export const engineeringForChangeAdapter: SourceAdapter = {
  id: "engineering-for-change",
  fullCatalogue: false,
  async discover(ctx) {
    const target = ctx.source.homepage;
    try {
      await ctx.fetchText(target);
    } catch (error) {
      if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
        throw new AccessBlockedError(
          "Engineering for Change returned a bot wall. The library will not bypass it.",
          error.status,
        );
      }
      throw error;
    }
    throw new AccessBlockedError(
      "Engineering for Change did not expose a machine-readable solutions catalogue to this client.",
      403,
    );
  },
  fetch: defaultFetch,
  parse: parseEngineeringForChange,
};
