# Asia volume step 1 — failing / zero-item source fixes

Dry-run: `npx tsx scripts/asia-batch-dry-run.ts --limit=500` (2026-10-08, cloud agent egress).

**Before (baseline on branch):** ~14 sources with `discovered > 0`; priority gaps on Hub71, HKSTP, Circulate, SGInnovate, Startup India, MYStartup, dcamp.

**After this PR:** bespoke **Hub71 JSON** (`/all-startups`, 316 startups), **HKSTP sitemap** (1,299 directory companies), **Circulate** company sitemap (28), plus collection URL corrections and NIA/OIN adapter groundwork.

## Priority sources (requested order)

| Source | Discovered (post) | Expected new (ingest) | Risk |
|--------|-------------------|------------------------|------|
| `sginnovate-portfolio` | 0 | 0 until Drupal AJAX portfolio is wired | **High** — JS-only listing; static HTML has no `/our-portfolio/{slug}` links |
| `startup-sg` | 0 | 0 | **Med** — programme marketing pages, no public startup registry URL found |
| `hub71-startup-directory` | **316** | **~300** first full run (minus cross-source URL reuse) | **Low** — public JSON listing |
| `cradle-fund` | FAIL (timeout) | 0 until MY site stable | **Med** — `cradle.com.my/portfolio` timed out from egress |
| `mystartup-malaysia` / `mystartup-startup-directory` | FAIL (fetch) | 0 | **Med** — `mystartup.my` unreachable from agent; verify from Railway |
| `startup-india-showcase` | FAIL (Wayback 404) | 0 | **High** — live `startupindia.gov.in` **403** CloudFront; Wayback snapshot not found |
| `national-startup-awards-india` | FAIL (Wayback 404) | 0 | **High** — same as showcase |
| `seoul-startup-plus` / `dcamp-startup-directory` | FAIL / 0 | 0 | **Med** — Seoul hub fetch fail; dcamp has no static startup index at probed paths |
| `findit-taiwan` / `startup-terrace-taiwan` | FAIL | 0 | **Med** — TLS/fetch errors from egress |
| `vietnam-nic`, `startup-philippines*`, `startup-studio-indonesia` | 0 | TBD after path adapters | **Med** — generic queue; need listing-specific patterns (step 1.5) |
| `hkstp-company-directory` | **1299** | **~800–1200** (caps / junk filter) | **Low** — sitemap-backed |
| `open-innovation-network-singapore` | 0 | 0 | **Med** — success-story detail URLs not in static HTML (CMS/JS) |
| `nia-innovation-catalogue` | 0 | 0 until `duplicate_of` resolved (step 3) | **Med** — detail links not in static advance search HTML |
| `circulate-capital` | **28** | **~25** | **Low** — `companies_pt-sitemap.xml` |

## Adapter / URL changes in this PR

- **`hub71-startup-directory.ts`** — discovers via `https://www.hub71.com/all-startups?page=&perPage=`.
- **`hkstp-company-directory`** — sitemap index + `/en/directory/{sector}/{slug}` path pattern.
- **`circulate-capital`** — `/company/{slug}` + `companies_pt-sitemap.xml`.
- **`open-innovation-network-singapore`** — bespoke html-catalogue (listing still JS-empty).
- **`nia-innovation-catalogue.ts`** — detail-only link filter; full catalogue pending live HTML/API.
- **`config/sources.yaml`** — collection URLs for SGInnovate full portfolio, OIN stories index, NIA advance search, Cradle portfolio, Startup SG programme page, Wayback timestamps for India (still failing).

## Truly unreachable from egress (keep enabled; do not drop unless robots forbid)

| Source | HTTP | Action |
|--------|------|--------|
| `cyberport`, `cyberport-incubation-programme` | **403** | Documented; no drop (government site, bot wall) |
| `adb-ventures-portfolio` | **403** | Documented |
| `startup-india-showcase`, `national-startup-awards-india` (live) | **403** | Use alternate open data in step 2 |
| `wavemaker-impact-portfolio`, `iterative-demo-day` (fetch) | **403** Cloudflare | Retry from production ingestor |

## Dry-run snapshot (non-zero discover)

See `/opt/cursor/artifacts/asia-dry-run-step1-postfix.txt` for the full 85-row table.

Notable counts: `j-startup` 268, `j-startup-impact` 269, `hkstp-company-directory` 1299, `hub71-startup-directory` 316, `birac-technology-portal` 53, `astana-hub` 58, `circulate-capital` 28, `the-liveability-challenge` 27, `startup-wheel` 21, `hub71` 17, `wavemaker-partners-portfolio` 12.

## Follow-ups (later PRs)

- **Step 2:** 10–15 new government / open-data Asia catalogues with dry-run samples.
- **Step 3:** `j-startup-impact` true duplicate of `j-startup`; `nia-innovation-catalogue` vs `nia-thailand` dedupe.
- SGInnovate: Drupal views AJAX or archived sitemap CDX harvest.
- MYStartup / Cradle: verify from production network.
