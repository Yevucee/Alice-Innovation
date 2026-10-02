import { type Cheerio, type CheerioAPI } from "cheerio";

/** Nav/boilerplate strings that must not become resource titles. */
export const CATALOGUE_BOILERPLATE_TITLE =
  /^(home|about(\s+us)?|contact(\s+us)?|menu|search|login|sign in|privacy|terms|cookies|portfolio|insights|news|blog|our team|subscribe|read more|share|skip to content|welcome|former winners|regions|categories|all posts|next|previous)$/i;

export const CATALOGUE_BOILERPLATE_LINE =
  /^(home|about|contact|menu|search|privacy|terms|subscribe|read more|share on|follow us|copyright|all rights reserved)/i;

export function isBoilerplateCatalogueTitle(title: string): boolean {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (trimmed.length < 3) return true;
  if (CATALOGUE_BOILERPLATE_TITLE.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^(the|our)\s+(team|story|mission|vision)$/i.test(trimmed)) return true;
  return false;
}

export function jsonLdNames(html: string): string[] {
  const names: string[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      collectJsonLdNames(parsed, names);
    } catch {
      /* ignore */
    }
  }
  return names.filter((name) => !isBoilerplateCatalogueTitle(name));
}

function collectJsonLdNames(node: unknown, out: string[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const entry of node) collectJsonLdNames(entry, out);
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (typeof record.name === "string" && record.name.trim()) out.push(record.name.trim());
  if (record["@graph"]) collectJsonLdNames(record["@graph"], out);
  if (record.mainEntity) collectJsonLdNames(record.mainEntity, out);
}

/** Prefer visible h1, then JSON-LD name, then og:title (not bare document title). */
export function resolveCatalogueTitle($: CheerioAPI, html: string, titleSuffixStrip?: RegExp): string {
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (h1 && !isBoilerplateCatalogueTitle(h1)) return stripSuffix(h1, titleSuffixStrip);

  for (const name of jsonLdNames(html)) {
    if (!isBoilerplateCatalogueTitle(name)) return stripSuffix(name, titleSuffixStrip);
  }

  const og = $("meta[property='og:title']").attr("content")?.replace(/&#xA0;/g, " ").trim() ?? "";
  if (og && !isBoilerplateCatalogueTitle(og)) return stripSuffix(og, titleSuffixStrip);

  const twitter = $("meta[name='twitter:title']").attr("content")?.trim() ?? "";
  if (twitter && !isBoilerplateCatalogueTitle(twitter)) return stripSuffix(twitter, titleSuffixStrip);

  let docTitle = $("title").text().trim();
  if (docTitle.includes("|")) docTitle = docTitle.split("|")[0]?.trim() ?? docTitle;
  if (docTitle.includes("–")) docTitle = docTitle.split("–")[0]?.trim() ?? docTitle;
  if (docTitle && !isBoilerplateCatalogueTitle(docTitle)) return stripSuffix(docTitle, titleSuffixStrip);

  return "";
}

function stripSuffix(title: string, suffix?: RegExp): string {
  if (!suffix) return title;
  return title.replace(suffix, "").trim();
}

export function pickNorrsken100Title($: CheerioAPI): string {
  const named = $("[fs-list-field='name'], [fs-list-field='Name']").first().text().trim();
  if (named && !isBoilerplateCatalogueTitle(named)) return named;
  for (const heading of $("h2, h3, h4").toArray()) {
    const text = $(heading).text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 2 || text.length > 120) continue;
    if (isBoilerplateCatalogueTitle(text)) continue;
    if (/^norrsken\b/i.test(text)) continue;
    return text;
  }
  return "";
}

export function pickGitexCohortTitle($: CheerioAPI, block: Cheerio<any>): string {
  for (const heading of block.find("h2, h3, h4, strong").toArray()) {
    const text = $(heading).text().replace(/\s+/g, " ").trim();
    if (!text || isBoilerplateCatalogueTitle(text)) continue;
    return text;
  }
  const firstLine = block.text().split("\n").map((line) => line.trim()).find((line) => line.length > 2 && !isBoilerplateCatalogueTitle(line));
  if (firstLine) return firstLine.slice(0, 120);
  return "";
}
