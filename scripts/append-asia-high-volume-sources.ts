/**
 * Append step-2 Asia high-volume source rows. Usage:
 *   npx tsx scripts/append-asia-high-volume-sources.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MARKER = "  - id: e27\n";

const BLOCK = `
  - id: edb-singapore-innovation-insights
    name: EDB Singapore innovation insights
    category: asia-innovation
    description: "Asia step 2: EDB news & insights archive (sitemap). Programme-selected innovation stories."
    homepage: https://www.edb.gov.sg/
    collection_url: https://www.edb.gov.sg/en/news-and-insights
    enabled: true
    status: PARTIAL
    resource_types:
      - PROJECT
      - SOLUTION
    update_class: MONTHLY
    adapter: edb-singapore-innovation-insights
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: sitemap
      sitemap: https://www.edb.gov.sg/sitemap.xml
      rss: null
      notes: "Dry-run before full ingest; article pages not company registries."
    limits:
      requests_per_minute: 8
      concurrency: 1
      max_items_per_run: 500
    coverage:
      historical_backfill: not-started
      notes: Added step 2 high-volume Asia archive.

  - id: enterprisesg-innovation-startup-blog
    name: Enterprise Singapore innovation & startup blog
    category: asia-innovation
    description: "Asia step 2: EnterpriseSG blog archive (sitemap)."
    homepage: https://www.enterprisesg.gov.sg/
    collection_url: https://www.enterprisesg.gov.sg/resources/blog
    enabled: false
    status: PARTIAL
    resource_types:
      - PROJECT
    update_class: MONTHLY
    adapter: enterprisesg-innovation-startup-blog
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: sitemap
      sitemap: https://www.enterprisesg.gov.sg/sitemap.xml
      rss: null
      notes: Filter startup/innovation tagged posts at enrich stage.
    limits:
      requests_per_minute: 8
      concurrency: 1
      max_items_per_run: 300
    coverage:
      historical_backfill: not-started
      notes: Added step 2.

  - id: imda-innovation-blog
    name: IMDA innovation blog
    category: asia-innovation
    description: "Asia step 2: IMDA blog articles (sitemap)."
    homepage: https://www.imda.gov.sg/
    collection_url: https://www.imda.gov.sg/resources/blog/blog-articles
    enabled: true
    status: PARTIAL
    resource_types:
      - PROJECT
    update_class: MONTHLY
    adapter: imda-innovation-blog
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: sitemap
      sitemap: https://www.imda.gov.sg/sitemap.xml
      rss: null
      notes: ""
    limits:
      requests_per_minute: 8
      concurrency: 1
      max_items_per_run: 300
    coverage:
      historical_backfill: not-started
      notes: Added step 2.

  - id: taiwan-startup-stadium-founder-stories
    name: Taiwan Startup Stadium founder stories
    category: asia-innovation
    description: "Asia step 2: TSS founder story archive (sitemap)."
    homepage: https://www.startupstadium.tw/
    collection_url: https://www.startupstadium.tw/blog-zh
    enabled: true
    status: PARTIAL
    resource_types:
      - ORGANISATION
      - PROJECT
    update_class: MONTHLY
    adapter: taiwan-startup-stadium-founder-stories
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: sitemap
      sitemap: https://startupstadium.tw/sitemap.xml
      rss: null
      notes: ""
    limits:
      requests_per_minute: 8
      concurrency: 1
      max_items_per_run: 500
    coverage:
      historical_backfill: not-started
      notes: Added step 2.

  - id: startupsg-events-archive
    name: Startup SG events archive
    category: asia-innovation
    description: "Asia step 2: StartupSG public events calendar (sitemap)."
    homepage: https://www.startupsg.gov.sg/
    collection_url: https://www.startupsg.gov.sg/events
    enabled: true
    status: PARTIAL
    resource_types:
      - PROJECT
    update_class: MONTHLY
    adapter: startupsg-events-archive
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: sitemap
      sitemap: https://www.startupsg.gov.sg/sitemap.xml
      rss: null
      notes: Event pages; not company registries.
    limits:
      requests_per_minute: 8
      concurrency: 1
      max_items_per_run: 500
    coverage:
      historical_backfill: not-started
      notes: Added step 2.

  - id: designsingapore-impact-stories
    name: DesignSingapore impact stories
    category: asia-innovation
    description: "Asia step 2: DesignSingapore stories (WP REST when available)."
    homepage: https://designsingapore.org/
    collection_url: https://designsingapore.org/stories/
    enabled: false
    status: PARTIAL
    resource_types:
      - PROJECT
    update_class: MONTHLY
    adapter: designsingapore-impact-stories
    access:
      class: PUBLIC
      status: UNVERIFIED_COLLECTION
      robots_checked: false
      terms_checked: false
    discovery:
      preferred_method: html
      sitemap: null
      rss: null
      notes: "Disabled until WP catalogue has volume (dry-run 1 post)."
    limits:
      requests_per_minute: 8
      concurrency: 1
    coverage:
      historical_backfill: not-started
      notes: Added step 2.

`;

const path = join(process.cwd(), "config/sources.yaml");
const text = readFileSync(path, "utf8");
if (text.includes("id: edb-singapore-innovation-insights")) {
  console.log("Asia step-2 sources already present; skipping.");
  process.exit(0);
}
if (!text.includes(MARKER)) {
  throw new Error("Insert marker not found (e27 block)");
}
writeFileSync(path, text.replace(MARKER, `${BLOCK}${MARKER}`));
console.log("Appended 5 Asia step-2 sources before e27.");
