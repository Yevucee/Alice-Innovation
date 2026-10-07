# Asia source ingest status matrix

Generated from `docs/asia-adapter-ready-slugs.json` (discover dry-run, 2026-10-07) and `docs/asia-source-acquisition.md` (HTTP preflight). All **85** `asia-innovation` rows remain **`enabled: true`** in `config/sources.yaml`.

Legend:

- **Working** — dry-run `discovered > 0` with current adapters.
- **Adapter fix** — HTTP OK (or fixable URL); needs path/sitemap/bespoke adapter (follow-up PRs).
- **URL / egress** — collection URL 404, 403, timeout, or 502 from probe; fix `collection_url` or accept skip until site is reachable.
- **SPA / JS** — listing HTML has no static detail links; needs API, sitemap, or headless fetch.
- **Duplicate** — shares catalogue with another slug (ingest one).

## Working (3)

| Source | Discovered | Notes |
|--------|------------|--------|
| `j-startup` | 268 | Bespoke html-catalogue |
| `j-startup-impact` | 269 | Duplicate listing of `j-startup` |
| `wavemaker-partners-portfolio` | 12 | Bespoke `/portfolio/` adapter |

## Discover 0 — HTTP OK, adapter fix likely (52)

Generic queue used wrong parent path pattern before `inferCataloguePathPatternFromCollectionUrl` (fixed in adapter follow-up). Bespoke adapters still needed where noted.

| Source | HTTP | Cause | Adapter fix? |
|--------|------|--------|--------------|
| `birac-technology-portal` | 200 | Generic catalogue; listing not startup detail pages | Maybe — verify listing paths |
| `ccamp` | 200 | Generic catalogue path mismatch | Yes — collection path pattern |
| `atal-innovation-mission` | 200 | Hub page, not company catalogue | Maybe — find portfolio URL |
| `atal-incubation-centres` | 200 | Generic catalogue | Yes |
| `birac-bionest` | 200 | Generic catalogue | Yes |
| `startup-sg` | 200 | Government hub, not detail URLs | Maybe |
| `sginnovate-portfolio` | 200 | JS Drupal portfolio; static scrape empty | Yes — sitemap `/our-portfolio/` (in progress) |
| `open-innovation-network-singapore` | 200 | Generic catalogue | Yes |
| `ipi-singapore-innovation-marketplace` | 200 | Generic catalogue | Yes |
| `the-liveability-challenge` | 200 | Programme site, not org list | Maybe |
| `nus-enterprise` | 200 | Generic catalogue | Yes |
| `startup-terrace-kaohsiung` | skip | Duplicate of `startup-terrace-taiwan` | N/A |
| `dcamp-startup-directory` | 200 | Korean directory SPA | Partial — API or sitemap |
| `k-startup-grand-challenge` | 200 | Programme marketing site | Maybe |
| `kised` | 200 | Agency hub | Maybe |
| `hkstp-company-directory` | 200 | Was matching `/en/discover` etc. | Yes — collection `/en/directory/...` pattern |
| `hkust-entrepreneurship-center` | 200 | Was ingesting events/contact | Yes — `/node/` + startup-alumni (in progress) |
| `startup-thailand-ecosystem` | 200 | Generic catalogue | Yes |
| `nia-thailand` | 200 | Generic catalogue | Yes |
| `nia-innovation-catalogue` | 200 | Duplicate homepage of `nia-thailand` | Maybe |
| `cradle-fund` | 200 | Generic catalogue | Yes |
| `cradle-seed-ventures` | 200 | Duplicate homepage | Maybe |
| `startup-studio-indonesia` | 200 | Generic catalogue | Yes |
| `1000-startup-digital` | 200 | Generic catalogue | Yes |
| `indigo-indonesia` | 200 | Generic catalogue | Yes |
| `startup-wheel` | 200 | Generic catalogue | Yes |
| `techfest-vietnam` | 200 | Generic catalogue | Yes |
| `vietnam-nic` | 200 | Generic catalogue | Yes |
| `startup-philippines` | 200 | Generic catalogue | Yes |
| `startup-philippines-directory` | 200 | Has `/startups` path | Yes |
| `startup-bangladesh` | 200 | Generic catalogue | Yes |
| `startup-bangladesh-portfolio` | 200 | Duplicate homepage | Maybe |
| `ignite-pakistan` | 200 | Generic catalogue | Yes |
| `pakistan-national-incubation-centres` | 200 | Duplicate homepage | Maybe |
| `astana-hub` | 200 | Generic catalogue | Yes |
| `astana-hub-company-network` | 200 | `/en/startup/` listing | Yes |
| `hub71` | 200 | Homepage only | Maybe — use `hub71-startup-directory` |
| `hub71-startup-directory` | 200 | SPA — no static startup links | Partial — API/headless |
| `sheraa` | 200 | Generic catalogue | Yes |
| `in5-dubai` | 202 | Generic catalogue | Yes |
| `kaust-innovation` | 200 | Generic catalogue | Yes |
| `kaust-innovation-ventures` | 200 | Ventures subpath | Yes |
| `kaust-taqadam` | 200 | Generic catalogue | Yes |
| `kaust-scalex-portfolio` | 200 | Bespoke adapter exists; dry-run 0 | Yes — verify ScaleX HTML |
| `kaust-entrepreneurial-spinouts` | 200 | Spinouts path | Yes |
| `startup-in-shanghai` | 200 | Gov portal, not startups | Unlikely without new URL |
| `china-college-students-innovation-competition` | 200 | Gov portal | Unlikely |
| `hicool` | 200 | Competition site | Maybe |
| `accelerating-asia` | 200 | Squarespace widget; no detail hrefs | Partial — embed data / manual |
| `iterative` | 200 | Homepage | Use `iterative-demo-day` |
| `iterative-demo-day` | 200 | Bespoke `/companies/` | Yes — verify dry-run after path fix |
| `wavemaker-impact-portfolio` | 200 | Bespoke adapter | Yes |
| `insignia-ventures-partners` | 200 | Bespoke `/portfolio/` | Yes |
| `iit-bombay-innovation` | 200 | University incubator | Yes |
| `iit-kanpur-innovation` | 200 | University SIIC | Yes |
| `nus-enterprise-innovation` | 200 | `/startups` listing | Yes |
| `hkust-innovation` | 404 | Wrong collection URL (`/startups`) | Yes — point at `startup-alumni` / HKUST adapter |

## Discover 0 — HTTP failed (22)

| Source | HTTP | Cause | Adapter fix? |
|--------|------|--------|--------------|
| `startup-india-showcase` | 404 | Startup India URL moved | Yes — update `collection_url` |
| `national-startup-awards-india` | 404 | Awards URL moved | Yes — update URL |
| `switch-slingshot` | error | SWITCH site fetch failed | Maybe — retry / new URL |
| `ntuitive` | 404 | `/our-startups` gone | Yes — new portfolio URL |
| `findit-taiwan` | error | TLS / block from egress | Maybe — proxy / alternate URL |
| `startup-terrace-taiwan` | error | Fetch failed | Maybe |
| `seoul-startup-plus` | error | Fetch failed | Maybe |
| `seoul-bio-hub` | error | Fetch failed | Maybe |
| `hkstp-elite-portfolio` | 404 | Elite page removed | Yes — new URL or drop listing |
| `cyberport` | 403 | Bot wall | Unlikely without allowlist |
| `cyberport-incubation-programme` | 403 | Bot wall | Unlikely |
| `mystartup-malaysia` | error | Fetch failed | Maybe |
| `mystartup-startup-directory` | error | Fetch failed | Maybe |
| `climate-impact-innovations-challenge` | error | Domain down | No until site up |
| `startup-sri-lanka` | 502 | Server error | Retry later |
| `astana-hub-startup-programmes` | 404 | Programmes path wrong | Yes — update URL |
| `china-innovation-entrepreneurship-competition` | error | `.cn` fetch blocked | Maybe — mirror / RSS |
| `adb-ventures-portfolio` | 403 | ADB bot wall | Unlikely |
| `circulate-capital` | 404 | `/portfolio` 404 | Yes — find live investments URL |
| `appworks-accelerator` | 404 | `/companies` and `/portfolio` 404 | Yes — find current portfolio URL |
| `thinkzone-ventures` | error | Fetch failed | Maybe |
| `iit-delhi-innovation` | error | Fetch failed | Maybe |
| `iit-madras-innovation` | error | Fetch failed | Maybe |
| `iit-kharagpur-innovation` | error | Fetch failed | Maybe |
| `ntu-innovation` | 404 | NTUitive portfolio 404 | Yes — align with `ntuitive` URL fix |

## Blocked tier (not in the 85 enabled catalogue)

`e27`, `techinasia`, `crunchbase`, etc. remain `status: BLOCKED` — terms / login walls.

## Regenerate discover sweep

```bash
npm run asia:dry-run-all   # or scripts/asia-dry-run-all.ts
```
