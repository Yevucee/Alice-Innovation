import { createCohortPageAdapter } from "./africa-second-pass-adapters.js";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { SourceAdapter } from "./types.js";

/** Real adapters for PAUSED sources (enabled: false). Ready for a later ingest queue. */
export const pausedCatalogueAdapters: SourceAdapter[] = [
  createCohortPageAdapter({
    id: "africa-climate-ventures",
    programme: "Africa Climate Ventures",
    resourceType: "ORGANISATION",
  }),
  createHtmlCatalogueAdapter({
    id: "social-innovation-academy",
    siteOrigin: "https://www.socialinnovationacademy.eu",
    pathPattern: /^\/project\/[^/]+\/?$/i,
    wordpressRest: { origin: "https://www.socialinnovationacademy.eu", postType: "project" },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "efficiency-for-access",
    siteOrigin: "https://efficiencyforaccess.org",
    pathPattern: /^\/(news|innovation-challenges|our-work)\/[^/]+\/?$/i,
    sitemap: {
      url: "https://efficiencyforaccess.org/sitemap_index.xml",
      followSitemapIndex: true,
      locPathPattern: /\/(news|innovation-challenges)\//,
    },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "imagine-h2o",
    siteOrigin: "https://www.imagineh2o.org",
    pathPattern: /^\/(portfolio|company|companies)\/[^/]+\/?$/i,
    sitemap: { url: "https://www.imagineh2o.org/sitemap.xml", followSitemapIndex: true },
    sitemapOnly: true,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
];
