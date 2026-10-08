# Open volume dry-run report (2026-10-08)

Dry-run only — **no new sources enabled** in this change set except existing Asia fixes (Hub71 JSON path, Circulate `collection_url`). New candidate `ycombinator-oss-companies` remains **`enabled: false`**.

Artifacts: `/opt/cursor/artifacts/cordis-pipeline-simulate.log`, `open-data-volume-probe.log`, `source-yield-rank-full.log`, `asia-yc-dry-run.log`, `backfill-remaining-estimate.log`.

## 1. CORDIS (3 enabled sources, 500/run cap)

### Why production shows almost no *visible* volume

| Stage | What happens | Approx. counts (simulation + code) |
|-------|----------------|-------------------------------------|
| **API raw hits** | Paginated search; programme filters (`HORIZON`, `H2020`, `EIC`) return the **same** `total≈1,234,548` as bare `contenttype='project'` — filters likely ignored by API or wrong field syntax | 500 hits sampled across 10×50 pages per slug |
| **Innovation filter** | `cordisHitLooksInnovationRelevant` in discover **and** parse | **~14%** pass (72/500 per slug in simulation) |
| **Per-run dedupe** | Dedupe by `relatedProjectReference` / id before cap | **~33 unique** projects in 500-hit sample |
| **Discover cap** | `PHASE2_DISCOVER_CAP = 500` but filter+dedupe often yields **≤33–72 refs/run** before fetch | `items_discovered` on run ≈ refs returned |
| **Parse** | Sets `grant_record: true` in `rawMetadata` | Inserts succeed but **hidden from default browse** (`search-sql` excludes `grant_record`) |
| **Cross-source dedupe** | Three enabled slugs share overlapping CORDIS project URLs | Second/third slug → mostly `unchanged` / URL collision, not new browse items |
| **Insert** | Upsert by canonical URL | Expect **`items_new` ≪ discovered** after first slug; further runs mostly updates |

**Not primarily “dedupe killing everything” on first run** — the binding limits are **strict innovation filter**, **low unique yield per 500 API rows**, **500/run cap**, and **grant_record browse exclusion** (items exist but do not grow public catalogue counts the same way).

### Production run history

This agent’s `DATABASE_URL` is **not production** (no `ingestion_runs` rows for CORDIS slugs; `item_count=0`). On Railway, inspect:

```bash
npx tsx scripts/cordis-run-analysis.ts
```

Check `items_discovered`, `items_new`, `items_failed`, and `pipeline_stats->cross_source_reuse` per slug.

---

## 2. Open-API / bulk candidates (≥6 dry-run)

Probe: `npx tsx scripts/open-data-volume-probe.ts --discover-cap=800` (local DB dedupe estimates are **0** — empty dev DB; production will be lower).

| Candidate | Total available (probe) | Quality gate pass (sample) | Licence / robots | Est. new after dedupe (prod) | Notes |
|-----------|-------------------------|----------------------------|------------------|------------------------------|--------|
| **Y Combinator OSS JSON** (`ycombinator-oss-companies`) | **6,279** companies (full JSON) | **~19%** (thin one-liners → `short_description` etc.) | Public JSON mirror; adapter `skipRobotsGuard` | **~5k+** orgs if enabled; review-heavy | **PR: new adapter, disabled** |
| **NIH RePORTER SBIR/STTR** (`nih-sbir-sttr-portfolio`) | 800+ per capped discover (API paginated) | **~98%** | Open API | **High** (grants as `grant_record`-style programmes) | Already in YAML, disabled |
| **NSF awards** (`nsf-awards-catalogue`) | 800+ per cap | **~99%** | Open API | **High** | Already in YAML, disabled |
| **UKRI GTR** (`ukri-gtr-research-projects`) | 800+ per cap | **~95%** | Open API | **High** | Research projects |
| **World Bank projects** (`world-bank-development-projects`) | 800+ per cap | **~84%** | Open API | Medium–high | Broader development, not all “startups” |
| **USAspending SBIR/STTR** | 800+ per cap | **~0%** (award titles, not innovation catalogue shape) | Open API | Low usefulness | Poor fit for browse quality gate |
| **EU Innovation Radar** | — | — | **403** from ingestor egress | N/A | Blocked without alternate access |
| **Wikidata SPARQL** (startups `Q4830453`) | Query returns 200 | Not run end-to-end | Open data; rate limits | TBD | Needs dedicated adapter + timeout handling |
| **Devpost** `api/hackathons` | HTTP 200 | No stable public bulk API (404 on other paths) | Scraping risk | Low | Not recommended without partnership API |

### Sample records (10 each)

See `open-data-volume-probe.log` and `asia-yc-dry-run.log` for YC, NIH, NSF, UKRI, World Bank, USAspending lines.

**Recommended next enables (after you approve samples):** `nih-sbir-sttr-portfolio`, `nsf-awards-catalogue`, and optionally `ycombinator-oss-companies` (accept higher NEEDS_REVIEW rate or relax gate for org listings).

---

## 3. Enabled sources — yield ranking

From `npx tsx scripts/source-yield-rank.ts` on **this environment’s DB** (stale vs production; CORDIS/Asia runs missing):

| slug | item_count | discovered (last run) | new | updated | failed | needs_review_% |
|------|------------|----------------------|-----|---------|--------|----------------|
| mit-solve | 293 | 0 | 0 | 0 | 0 | 33.2 |
| norrsken-accelerator | 85 | 100 | 0 | 0 | 0 | 10.2 |
| oceanhub-africa | 46 | 46 | 0 | 0 | 0 | 52.2 |
| … | … | … | … | … | … | … |

**Full table:** `source-yield-rank-full.log` (~140 enabled rows). On production, re-run the script and sort by `items_new` desc — expect **HKSTP**, **CORDIS** (low visible yield), and zero-yield Asia (**hub71**, **circulate**) until Hub71 JSON fix deploys.

**Wasted effort signals:** sources with `discovered > 0` but `new + updated = 0` every run (checkpoint saturation); CORDIS triple overlap; sources with high `needs_review_%` and low acceptance (e.g. oceanhub-africa 52%).

---

## 4. Backfill — atlas / solar-impulse / mit-solve

| Source | In DB `item_count` (local) | Catalogue discover | Est. remaining | Targeted Railway variables |
|--------|---------------------------|--------------------|----------------|---------------------------|
| **atlas-of-the-future** | 0 | **948** | **948** | `INGEST_ONLY_SOURCES=atlas-of-the-future` + `INGEST_FULL=true` |
| **solar-impulse** | 0 | *failed here* (`redirect count exceeded` on discover) | Run from **ingestor egress** after deploy | `INGEST_ONLY_SOURCES=solar-impulse` + `INGEST_FULL=true` |
| **mit-solve** | 293 (local) | **~25,034** refs | **~24,7k** | `INGEST_ONLY_SOURCES=mit-solve` + `INGEST_ITEM_LIMIT=500` (repeat per `docs/railway-ingestor-targeted-run.md`) or `INGEST_FULL=true` for full catalogue if budget allows |

Script: `npx tsx scripts/backfill-remaining-estimate.ts`

---

## 5. Hub71 & Circulate Capital URL fixes

| Source | Issue | Fix in this PR |
|--------|--------|----------------|
| **hub71-startup-directory** | Detail HTML 404 / empty runs | Discover via `https://www.hub71.com/all-startups` JSON; **fetch/parse from `listingHtml`** (website URL preferred). Dry-run: **316** startups, 5 samples OK. |
| **circulate-capital** | `/investments` 404 | `collection_url` → `https://www.circulatecapital.com/companies/`; adapter sitemap + `/company/{slug}`. Dry-run: **28** companies. |

**Run A (unchanged):** `INGEST_ONLY_SOURCES=hub71-startup-directory,hkstp-company-directory,circulate-capital` + `INGEST_FULL=true` after deploy.

---

## Scripts added

| Script | Purpose |
|--------|---------|
| `scripts/cordis-pipeline-simulate.ts` | Filter stages for enabled CORDIS slugs |
| `scripts/cordis-run-analysis.ts` | Last runs + `grant_record` counts (prod DB) |
| `scripts/open-data-volume-probe.ts` | Bulk candidate dry-run |
| `scripts/source-yield-rank.ts` | Enabled source yield table |
| `scripts/backfill-remaining-estimate.ts` | Atlas / solar / mit-solve remaining |
