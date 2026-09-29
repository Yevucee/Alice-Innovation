import { load } from "cheerio";
import { absoluteImageUrl, isUsableImageUrl } from "./draft.js";

const DEFAULT_SKIP = /placeholder|favicon|logo\.svg|injini.*logo|norrsken.*logo|32x injini/i;

/** First usable card image inside listing HTML (Webflow carousels, accordions, etc.). */
export function listingCardImageUrl(
  html: string,
  pageUrl: string,
  options?: { skipPattern?: RegExp; preferSelector?: string },
): string | null {
  const $ = load(html);
  const skip = options?.skipPattern ?? DEFAULT_SKIP;
  let found: string | null = null;
  if (options?.preferSelector) {
    const preferred = $(options.preferSelector).first();
    const src = preferred.attr("src")?.trim();
    if (src && !skip.test(src)) {
      const resolved = absoluteImageUrl(pageUrl, src);
      if (resolved && isUsableImageUrl(resolved)) return resolved;
    }
  }

  $("body").find("img[src]").each((_, element) => {
    const src = $(element).attr("src")?.trim();
    if (!src || skip.test(src)) return;
    const resolved = absoluteImageUrl(pageUrl, src);
    if (!resolved || !isUsableImageUrl(resolved)) return;
    found = resolved;
    return false;
  });
  return found;
}
