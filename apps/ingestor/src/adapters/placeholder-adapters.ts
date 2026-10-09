import { loadSources } from "@alice/source-registry";
import { resolve } from "node:path";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { SourceAdapter } from "./types.js";

function createPlaceholder(id: string): SourceAdapter {
  return {
    id,
    fullCatalogue: false,
    async discover() {
      return [];
    },
    async fetch() {
      throw new Error(`Adapter ${id} is registered but discovery is not implemented yet.`);
    },
    parse() {
      throw new Error(`Adapter ${id} is registered but parsing is not implemented yet.`);
    },
  };
}

export const remainingCatalogueAdapters: SourceAdapter[] = [
  createHtmlCatalogueAdapter({
    id: "grand-challenges-canada",
    siteOrigin: "https://www.grandchallenges.ca",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    wordpressRest: { origin: "https://www.grandchallenges.ca", postType: "projects" },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "practical-action",
    siteOrigin: "https://practicalaction.org",
    pathPattern: /^\/our-work\/projects\/[^/]+\/?$/i,
    resourceType: "PROJECT",
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
  }),
  createHtmlCatalogueAdapter({
    id: "third-derivative",
    siteOrigin: "https://www.third-derivative.org",
    pathPattern: /^\/portfolio\/[a-z0-9][a-z0-9-]{2,}\/?$/i,
    excludePathPattern: /^\/portfolio\/(rss|tag)$/i,
    htmlUrlPattern: /https:\/\/www\.third-derivative\.org\/portfolio\/[a-z0-9][a-z0-9-]{2,}/gi,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "biomimicry-institute",
    siteOrigin: "https://biomimicry.org",
    pathPattern: /^\/innovation\/[^/]+\/?$/i,
    resourceType: "SOLUTION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "ideo-org",
    siteOrigin: "https://www.ideo.org",
    pathPattern: /^\/project\/[^/]+\/?$/i,
    resourceType: "PROJECT",
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
  }),
  createHtmlCatalogueAdapter({
    id: "shell-foundation",
    siteOrigin: "https://shellfoundation.org",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    wordpressRest: { origin: "https://shellfoundation.org", postType: "portfolio" },
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "climate-kic",
    siteOrigin: "https://www.climate-kic.org",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    wordpressRest: { origin: "https://www.climate-kic.org", postType: "portfolio" },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "what-design-can-do",
    siteOrigin: "https://www.whatdesigncando.com",
    pathPattern: /^\/product\/[^/]+\/?$/i,
    wordpressRest: { origin: "https://www.whatdesigncando.com", postType: "product" },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "atlas-of-the-future",
    siteOrigin: "https://atlasofthefuture.org",
    pathPattern: /^\/project\/[^/]+\/?$/i,
    excludePathPattern: /^\/project\/?$/i,
    sitemapOnly: true,
    sitemap: {
      url: "https://atlasofthefuture.org/sitemap_index.xml",
      followSitemapIndex: true,
      locPathPattern: /\/project\//,
    },
    resourceType: "PROJECT",
    evidenceBasis: "EDITORIALLY_CURATED",
  }),
  createHtmlCatalogueAdapter({
    id: "ideo-design-kit",
    siteOrigin: "https://www.designkit.org",
    pathPattern: /^\/case-studies\/[^/]+\.html$/i,
    extraListingUrls: ["https://www.designkit.org/case-studies.html"],
    resourceType: "CASE_STUDY",
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
  }),
];

export function buildPlaceholderAdapters(skipAdapterIds: ReadonlySet<string>): SourceAdapter[] {
  const sources = loadSources(resolve(process.cwd(), "config/sources.yaml"));
  const adapters: SourceAdapter[] = [];
  for (const source of sources) {
    if (skipAdapterIds.has(source.adapter)) continue;
    adapters.push(createPlaceholder(source.adapter));
  }
  return adapters;
}
