# Open volume candidates (2026-10-09)

Live probes from Cloud Agent egress (not local DB). Ranked by **estimated new passing records ÷ effort**. Africa/Asia first, then Europe/South America.

**Already in library (skip as “new”):** `cordis-eu-research-projects` (~59k), `wipo-green` (**~148k** API `totalElements`), `mit-solve` (~25k done), `ycombinator-oss-companies` (~6.3k, **disabled**), `hub71-startup-directory` (316).

---

## Ranked verified candidates

| Rank | ID | Region | URL / access | Robots / ToS | ~Records | Gate pass (10 samples) | Recommend |
|-----:|----|--------|--------------|--------------|----------|-------------------------|-----------|
| 1 | `ycombinator-oss-companies` | Global | `https://yc-oss.github.io/api/companies/all.json` — static JSON | OSS repo; check YC mark policy | **6,279** | ~20/50 in prior report | **Enable** after sample approval (adapter exists, disabled) |
| 2 | `bioeconomycorporation-my-wp` | Asia (MY) | `https://www.bioeconomycorporation.my/wp-json/wp/v2/posts` | Public WP REST; news site ToS | **856** posts (`X-WP-Total`) | Low–medium (news headlines; many short) | **Investigate** — filter category/tag for “company” posts only |
| 3 | `ihub-nairobi-wp` | Africa (KE) | `https://ihub.co.ke/wp-json/wp/v2/posts` | Public REST | **165** posts | Low (events/news) | **Skip** as startup directory; OK as **article** source only |
| 4 | `j-startup` | Asia (JP) | Existing adapter + sitemap | Government programme | **~268** | Verified in repo | **Enable** maintenance (already in YAML) |
| 5 | `hub71-startup-directory` | Asia (UAE) | `https://www.hub71.com/all-startups` JSON | Public listing API | **316** | **211/316** pass on listing JSON | **Enable** after URL fix PR |
| 6 | `practical-action-wp` | Global | `https://www.practicalaction.org/wp-json/wp/v2/projects` | REST open | **72** | Adapter exists (`practical-action`) | **Skip** (low volume; enable if not already) |

### 1,000+ new records (verified reachable)

| Source | Count evidence | Notes |
|--------|----------------|--------|
| **WIPO GREEN** (enabled) | POST search `totalElements: 148069` | Not new — continue checkpointed backfill; drives NEEDS_REVIEW noise |
| **YC OSS** (disabled) | 6,279 companies JSON | Best *new* switch-on after policy sign-off |
| **CORDIS** (enabled) | ~59k projects | Innovation filter ~22% pass |

No additional **Africa/Asia** open API with **1,000+** clean startup/solution records was reachable from this environment without Cloudflare/geo blocks (Startup India, Startup Nation Central, EnterpriseSG, open.africa → blocked or DNS failure).

---

## Blocked or failed probes (do not guess)

| Candidate | Result |
|-----------|--------|
| Startup India API | HTTP 404 / DNS fail |
| Startup Nation Central / StartupBlink | Cloudflare 403 |
| `data.gov.ae`, `open.data.gov.sa` | DNS / unreachable |
| `open.africa` CKAN | HTTP 403 |
| `startupbase.com.br` API | TLS / fetch failed |
| `finder.startupnationcentral.org` | 403 |
| EU Innovation Radar API URLs | No JSON API found (HTML only) |
| `globalinnovationexchange.org` | API returns unrelated HTML (domain compromised/spam — **do not ingest**) |
| F6S sitemap | 404 |
| Techstars portfolio HTML | 0 `/companies/` links (JS-rendered) |

---

## Sample records (10 each, verified fetch)

### Hub71 (`all-startups` page 1, 2026-10-09)

| Title | Detail URL |
|-------|------------|
| (listing JSON) | `https://www.hub71.com/startups/{slug}` — 316 slugs; see dry-run |

### WIPO GREEN (API `search`, page 0)

| id | title (trimmed) |
|----|-----------------|
| 180107 | Optimization of Circulating Cooling Water… |
| 180106 | Green Power Direct Connection and Smart … |
| 180102 | PCB Industrial Energy-Saving Tech… |
| 180101 | (see live API) |
| … | 25 per page × 5923 pages |

### Bioeconomy Corporation Malaysia (WP posts)

| title (rendered) |
|------------------|
| Enhanced BioNexus Status to Fast-Track Malaysian Bioinnovati… |
| Sarawak to Host Southeast Asia's First… |
| Sarawak BioFoundry to Drive Regenera… |
| (856 total — mostly news, not portfolio) |

### YC OSS (existing fixture — first 3 from `all.json`)

Use `npx tsx scripts/yc-quality-samples.ts` for 10 pass + 10 fail tables (documented in `docs/open-volume-candidate-report.md`).

---

## Recommended attack order

1. Merge Hub71 URL fix → **+211** AUTO_INGESTED-class rows (105 NEEDS_REVIEW/thin on listing-only text).
2. Decision on **YC OSS** enable (+thousands; quality drops for thin descriptions).
3. **WIPO** backfill pacing + org-name handling (volume already enabled; fixes NEEDS_REVIEW growth).
4. **Bioeconomy Malaysia** only after category filter proves ≥1k company-like posts (else skip).
5. Re-probe **Startup India** / **Israel SNC** from production Railway egress (often blocked only on Cloud Agent).

Regenerate Hub71: `npx tsx scripts/hub71-dry-run.ts`
