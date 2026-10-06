import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { SourceAdapter } from "./types.js";

/** First-wave Asia html-catalogue adapters (expand after `asia:verify` + dry-run). */
export const asiaAdapters: SourceAdapter[] = [
  createHtmlCatalogueAdapter({
    id: "sginnovate-portfolio",
    siteOrigin: "https://www.sginnovate.com",
    pathPattern: /^\/our-portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "hub71-startup-directory",
    siteOrigin: "https://www.hub71.com",
    pathPattern: /^\/startups\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "accelerating-asia",
    siteOrigin: "https://www.acceleratingasia.com",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "wavemaker-partners-portfolio",
    siteOrigin: "https://wavemaker.vc",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "wavemaker-impact-portfolio",
    siteOrigin: "https://wavemakerimpact.com",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "circulate-capital",
    siteOrigin: "https://www.circulatecapital.com",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "insignia-ventures-partners",
    siteOrigin: "https://www.insignia.vc",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "thinkzone-ventures",
    siteOrigin: "https://thinkzone.vc",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "iterative-demo-day",
    siteOrigin: "https://www.iterative.vc",
    pathPattern: /^\/companies\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "appworks-accelerator",
    siteOrigin: "https://appworks.tw",
    pathPattern: /^\/portfolio\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
  createHtmlCatalogueAdapter({
    id: "kaust-scalex-portfolio",
    siteOrigin: "https://entrepreneurship.kaust.edu.sa",
    pathPattern: /^\/portfolio\/scalex\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  }),
];
