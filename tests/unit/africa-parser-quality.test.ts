import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { test } from "node:test";
import {
  isBoilerplateCatalogueTitle,
  pickGitexCohortTitle,
  pickNorrsken100Title,
  resolveCatalogueTitle,
} from "../../apps/ingestor/src/adapters/catalogue-parse-helpers.ts";
import {
  parseBaobabCard,
  parseBaobabPortfolioFromScript,
  parseNorrsken100Item,
  parseNorrskenAccordionItem,
  africaAdapters,
} from "../../apps/ingestor/src/adapters/africa-adapters.ts";
import { createCohortPageAdapter, africaSecondPassAdapters } from "../../apps/ingestor/src/adapters/africa-second-pass-adapters.ts";
import { parseHtmlCataloguePage } from "../../apps/ingestor/src/adapters/html-catalogue.ts";
import type { FetchedPage } from "../../apps/ingestor/src/adapters/types.ts";

function page(file: string, url: string, listingOnly = false): FetchedPage {
  return {
    url,
    finalUrl: url,
    status: 200,
    html: readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8"),
    etag: null,
    lastModified: null,
    listingOnly,
  };
}

test("resolveCatalogueTitle prefers h1 over og:title site brand", () => {
  const html = readFileSync(new URL("../fixtures/catalogue-page-h1.html", import.meta.url), "utf8");
  const $ = load(html);
  assert.equal(resolveCatalogueTitle($, html), "Acme Water Filters");
});

test("isBoilerplateCatalogueTitle rejects nav labels", () => {
  assert.equal(isBoilerplateCatalogueTitle("Home"), true);
  assert.equal(isBoilerplateCatalogueTitle("AgriBot Solutions"), false);
});

test("norrsken-100 parse uses fs-list-field name not page headings", () => {
  const draft = parseNorrsken100Item(page(
    "norrsken-100-card.html",
    "https://www.norrsken.org/100?item=solargrid-kenya",
    true,
  ));
  assert.equal(draft.title, "SolarGrid Kenya");
  assert.equal(draft.rawMetadata.listing_only, true);
});

test("gitex cohort parse picks heading from structured block", () => {
  const gitex = africaAdapters.find((adapter) => adapter.id === "gitex-africa-supernova");
  assert.ok(gitex);
  const draft = gitex!.parse(page(
    "gitex-cohort-block.html",
    "https://gitexafrica.com/africa-supernova-challenge?item=agribot",
    true,
  ));
  assert.equal(draft.title, "AgriBot Solutions");
  assert.match(draft.sourceSummary, /Agriculture/i);
});

test("pickGitexCohortTitle ignores boilerplate", () => {
  const $ = load("<div><h3>Home</h3><strong>Valid Startup</strong></div>");
  const block = $("div").first();
  assert.equal(pickGitexCohortTitle($, block), "Valid Startup");
});

test("cohort page adapter parse reads w-dyn card title", () => {
  const adapter = createCohortPageAdapter({
    id: "global-startup-awards-africa",
    programme: "Global Startup Awards Africa",
    resourceType: "ORGANISATION",
  });
  const draft = adapter.parse(page(
    "cohort-w-dyn-card.html",
    "https://www.globalstartupawards.com/former-winners?item=greenpay-ghana",
    true,
  ));
  assert.equal(draft.title, "GreenPay Ghana");
  assert.equal(draft.rawMetadata.cohort_source, true);
  assert.ok(draft.extractedText.length >= 40);
});

test("html catalogue page uses h1 not og site title", () => {
  const draft = parseHtmlCataloguePage(page(
    "catalogue-page-h1.html",
    "https://example.com/startups/acme-water-filters",
  ), {
    id: "example",
    siteOrigin: "https://example.com",
    pathPattern: /^\/startups\/[^/]+\/?$/i,
    resourceType: "ORGANISATION",
    evidenceBasis: "PROGRAMME_SELECTED",
  });
  assert.equal(draft.title, "Acme Water Filters");
});

test("pickNorrsken100Title skips Norrsken headings", () => {
  const $ = load("<div><h2>Norrsken 100</h2><h3>PayFlow Uganda</h3></div>");
  assert.equal(pickNorrsken100Title($), "PayFlow Uganda");
});

test("launchlab iframe page resolves h1 title", () => {
  const launchlab = africaSecondPassAdapters.find((a) => a.id === "su-launchlab");
  assert.ok(launchlab);
  const draft = launchlab!.parse(page(
    "launchlab-startup-page.html",
    "https://portfolio.example.com/startup/stellenbosch-biotech",
  ));
  assert.equal(draft.title, "Stellenbosch Biotech Ltd");
});

test("africa tech festival exhibitor uses h1 not og site title", () => {
  const atf = africaAdapters.find((a) => a.id === "africa-tech-festival-startup-hub");
  assert.ok(atf);
  const draft = atf!.parse(page(
    "atf-exhibitor.html",
    "https://africatechfestival.com/home/sponsors/nairobi-fintech-exhibitor-2026",
  ));
  assert.equal(draft.title, "Nairobi Fintech Collective");
});

test("baobab portfolio parser reads companies from Vite bundle snippet", () => {
  const js = `{name:"Adafri",description:"Payments",country:"Kenya",sector:"Fintech",url:"https://adafri.co"},{name:"Buyam",description:"Commerce",country:"Cameroon",sector:"Retail",url:"https://buyam.co/"}`;
  const rows = parseBaobabPortfolioFromScript(js);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Adafri");
  const draft = parseBaobabCard({
    url: "https://thebaobabnetwork.com/portfolio/?item=adafri",
    finalUrl: "https://thebaobabnetwork.com/portfolio/?item=adafri",
    status: 200,
    html: `<div class="portfolio-card__company-name">Adafri</div><div class="portfolio-card__company-text">Payments</div><a data-baobab-website href="https://adafri.co">site</a>`,
    etag: null,
    lastModified: null,
    listingOnly: true,
  });
  assert.equal(draft.title, "Adafri");
  assert.match(draft.canonicalUrl, /^https:\/\/adafri\.co\/?$/);
});

test("norrsken accordion still parses structured fields", () => {
  const html = `<div class="w-dyn-item"><div fs-list-field="name">EcoFarm</div><div fs-list-field="solution">Soil sensors</div></div>`;
  const draft = parseNorrskenAccordionItem({
    url: "https://accelerator.norrsken.org/portfolio?item=ecofarm",
    finalUrl: "https://accelerator.norrsken.org/portfolio?item=ecofarm",
    status: 200,
    html,
    etag: null,
    lastModified: null,
    listingOnly: true,
  });
  assert.equal(draft.title, "EcoFarm");
});
