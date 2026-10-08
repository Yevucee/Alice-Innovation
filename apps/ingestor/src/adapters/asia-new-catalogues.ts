import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { SourceAdapter } from "./types.js";

/** New Asia catalogue surfaces (step 2) — government / ecosystem archives with sitemap or WP REST. */
export const asiaNewCatalogueAdapters: SourceAdapter[] = [
  createHtmlCatalogueAdapter({
    id: "edb-singapore-innovation-insights",
    siteOrigin: "https://www.edb.gov.sg",
    pathPattern: /^\/en\/news-and-insights\/[^/]+\/?$/i,
    sitemap: {
      url: "https://www.edb.gov.sg/sitemap.xml",
      locPathPattern: /^\/en\/news-and-insights\/[^/]+\/?$/i,
    },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "enterprisesg-innovation-startup-blog",
    siteOrigin: "https://www.enterprisesg.gov.sg",
    pathPattern: /^\/resources\/blog\/[^/]+\/?$/i,
    sitemap: {
      url: "https://www.enterprisesg.gov.sg/sitemap.xml",
      locPathPattern: /^\/resources\/blog\/[^/]+\/?$/i,
    },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "imda-innovation-blog",
    siteOrigin: "https://www.imda.gov.sg",
    pathPattern: /^\/resources\/blog\/blog-articles\/[^/]+\/?$/i,
    sitemap: {
      url: "https://www.imda.gov.sg/sitemap.xml",
      locPathPattern: /^\/resources\/blog\/blog-articles\/[^/]+\/?$/i,
    },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "taiwan-startup-stadium-founder-stories",
    siteOrigin: "https://startupstadium.tw",
    pathPattern: /^\/blog-zh\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/?$/i,
    sitemap: {
      url: "https://startupstadium.tw/sitemap.xml",
      locPathPattern: /^\/blog-zh\/.+/i,
    },
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "startupsg-events-archive",
    siteOrigin: "https://www.startupsg.gov.sg",
    pathPattern: /^\/events\/\d+\/[^/]+\/?$/i,
    sitemap: {
      url: "https://www.startupsg.gov.sg/sitemap.xml",
      locPathPattern: /^\/events\/\d+\//i,
    },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "designsingapore-impact-stories",
    siteOrigin: "https://designsingapore.org",
    pathPattern: /^\/stories\/[^/]+\/?$/i,
    wordpressRest: { origin: "https://designsingapore.org", postType: "posts", perPage: 100 },
    resourceType: "PROJECT",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
];
