# Regional volume report (Africa / Europe / South America)

**Date:** 2026-10-08  
**Scope:** Report only — no new sources enabled, no merges. Dry-runs used local `alice_test` DB for `item_count` / last-run columns (production Railway CLI unavailable in cloud agent VM).

Scripts:

- `npx tsx scripts/region-coverage-dry-run.ts --category=africa-innovation --include-disabled`
- `npx tsx scripts/region-candidate-probe.ts --region=africa|europe|south-america`

Artifacts: `/opt/cursor/artifacts/africa-coverage-full.log`, `europe-coverage-planning.log`, `candidate-probe-*.log`.

---

## 1. Coverage tables

### Africa (`africa-innovation`, n=39)

Discover cap **80** per source unless noted. **Found** = dry-run discover count; **Ingested** = DB `item_count`.

| Source | En | Status | Ingested | Found | Low / reason |
|--------|----|--------|----------|-------|----------------|
| startgate-um6p | Y | PARTIAL | 0 | **1912** | discover-ok-not-ingested (ops backlog) |
| injini-african-edtech-map | Y | PARTIAL | 0 | **200** | discover-ok-not-ingested |
| afrilabs | Y | PARTIAL | 0 | **100** | discover-ok-not-ingested |
| founders-factory-africa | Y | PARTIAL | 0 | **81** | discover-ok-not-ingested |
| ventures-platform | Y | PARTIAL | 0 | **80** | discover-ok-not-ingested |
| africa-tech-festival-startup-hub | Y | PARTIAL | 35 | 80 | partial-ingest (cap) |
| digital-africa | Y | PARTIAL | 0 | **68** | discover-ok-not-ingested |
| **baobab-network** | Y | PARTIAL | 0 | **62** | **was zero-discover (SPA)** → fixed in draft PR |
| ihub-future-of-learning | Y | PARTIAL | 0 | **48** | discover-ok-not-ingested |
| oceanhub-africa | Y | PARTIAL | 46 | 45 | ok |
| norrsken-accelerator | Y | PARTIAL | 85 | 100 | ok (global list; geo filter at query) |
| cchub-syndicate | Y | PARTIAL | 0 | 19 | discover-ok-not-ingested |
| ghana-climate-innovation-centre | Y | PARTIAL | 0 | 15 | discover-ok-not-ingested |
| **kenya-climate-innovation-centre** | Y | PARTIAL | 0 | **47** | **was zero-discover** (www + `/news/*` sitemap) |
| gitex-africa-supernova | N | PAUSED | 0 | 10 | paused:ok |
| seedstars-africa | N | PARTIAL | 0 | 4 | low-volume |
| global-startup-awards-africa | Y | PARTIAL | 1 | 1 | low-volume |
| su-launchlab | Y | PARTIAL | 2 | 2 | low-volume |
| **norrsken-100** | Y | PARTIAL | 0 | FAIL | **401** Webflow auth wall on `/100` |
| africa-fintech-summit-alpha-expo | N | PARTIAL | 0 | 0 | zero-discover |
| africa-tech-summit-showcase | N | PARTIAL | 0 | 0 | zero-discover |
| africarena | N | PARTIAL | 0 | 0 | zero-discover |
| flat6labs-africa | N | PARTIAL | 0 | 0 | zero-discover |
| growthafrica | N | PARTIAL | 0 | 0 | zero-discover (CubePortfolio JS) |
| kosmos-innovation-centre-ghana | N | PARTIAL | 0 | 0 | zero-discover |
| mest-africa-challenge | N | PARTIAL | 0 | 0 | zero-discover |
| milken-motsepe-innovation-prize | N | PARTIAL | 0 | 0 | zero-discover |
| africa-climate-ventures | N | PAUSED | 0 | 1 | paused:low-volume |
| acumen, africa-prize, catalyst-fund, orange-social-venture-prize, saviu, startupbootcamp-afritech, undp-timbuktoo | N | PAUSED | 0 | 0 | paused:zero-discover / no adapter |
| africa-business-heroes, future-africa, vc4a, villgro-africa | N | BLOCKED | 0 | 0 | blocked:zero-discover / bot wall / ToS |

**Africa headline:** ~**2.7k+** URLs discoverable on enabled sources today (before cap), but only **~170** ingested. Largest gap is **ingest throughput**, not discover, except **baobab**, **kenya CIC**, and **norrsken-100**.

### Europe (planning — no ingest)

No `europe-innovation` category; table covers EU/UK open-data and related **general-innovation** sources.

| Source | En | Status | Ingested | Found (cap 50) | Low / reason |
|--------|----|--------|----------|----------------|--------------|
| cordis-eu-research-projects | Y | PARTIAL | 0 | 50 | discover-ok-not-ingested; catalogue **~59k** projects (grant_record, browse-hidden) |
| ukri-gtr-research-projects | N | PAUSED | 0 | 50 | paused; API works; enable after sample |
| nesta | Y | PARTIAL | 0 | 2 | low-volume listing |
| eit-food | Y | PARTIAL | 0 | 5 | low-volume |
| eu-innovation-radar | N | PAUSED | 0 | FAIL | **403** on innoradar API from egress |
| cordis-* (legacy duplicates) | N | PAUSED | — | — | superseded by `cordis-eu-research-projects` |

### South America (planning — no ingest)

**No** `south-america-innovation` sources in `sources.yaml` yet. Existing volume is **0**; candidates below are probe-only.

---

## 2. Africa fix list (ranked by items gained)

| Rank | Source | Est. gain | Fix type | Notes |
|------|--------|-----------|----------|-------|
| 1 | startgate-um6p | ~1,900 | **ops ingest** | Discover OK; run capped backfill |
| 2 | injini-african-edtech-map | ~200 | **ops ingest** | At discover cap |
| 3 | afrilabs | ~100 | **ops ingest** | Enabled hub list |
| 4 | founders-factory-africa, ventures-platform | ~80 each | **ops ingest** | Sitemap/HTML OK |
| 5 | digital-africa, ihub, cchub, ghana-cic | 15–68 | **ops ingest** | |
| 6 | **baobab-network** | **~62** | **adapter** | Vite SPA → read `/assets/index-*.js` embedded portfolio JSON |
| 7 | **kenya-climate-innovation-centre** | **~47** | **adapter/URL** | `www` host; `/news/*` from sitemap; `sitemapOnly` |
| 8 | norrsken-100 | ~100+ | **blocked** | HTTP **401**; keep using `norrsken-accelerator` |
| 9 | growthafrica, flat6labs, mest, etc. | ? | adapter | zero-discover; need JS/API routes |
| 10 | vc4a, villgro | large | **blocked/ToS** | Do not bypass bot walls |

**Draft PR (adapter/URL only):** `baobab-network` + `kenya-climate-innovation-centre` — **not merged**, no new enables.

---

## 3. New high-volume candidates (dry-run, disabled)

Probe script uses lightweight HTTP/regex; failures often mean **wrong path**, not necessarily hard block. Manual follow-ups noted.

### Africa (8 probes)

| Candidate | Total≈ | Gate pass≈ | Robots/licence | Est. new after dedupe | Notes / samples |
|-----------|--------|------------|----------------|----------------------|-----------------|
| vc4a-ventures-directory | 29* | 0%† | check / ToS | ~29 | *Regex over-counts nav; manual count **~hundreds** of `/ventures/{slug}/` possible with pagination adapter. Samples: `…/chale-spirulina/`, `…/tenx-nutrition/` |
| partech-africa-portfolio | FAIL 404 | — | likely | — | Use current Partech site path (portfolio moved) |
| afdb-projects-open | FAIL network | yes / open | — | AfDB JSON portal; worth dedicated open-data adapter |
| disrupt-africa-insights | 0 | — | media | — | No startup URLs on `/startups/` HTML |
| afrilabs-hub-network | FAIL 404 | — | — | `/hubs/` route changed |
| make-it-in-africa | FAIL network | GIZ | — | Retry from prod egress |
| norfund-investments | FAIL 404 | DFI | — | New portfolio URL needed |
| google-for-startups-africa | 6 | 0% | Google | ~6 | Programme index only, not company DB |

† Gate pass on probes uses **placeholder titles**; real adapter would fetch detail pages.

**Better Africa follow-ups (not in script):** VC4A paginated directory, AfDB `VProject?format=json`, OceanHub-style WordPress REST clones, **enabled** `startgate`/`injini` (already in registry).

### Europe (8 probes)

| Candidate | Total≈ | Gate pass≈ | Robots/licence | Est. new | Samples |
|-----------|--------|------------|----------------|----------|---------|
| cordis (search JSON) | 50 | **90%** | yes / CORDIS open | ~50 | `cordis.europa.eu/project/id/633080` … |
| ukri-gtr-api | 20 | **60%** | yes / UKRI | ~20 | GTR project refs |
| eic-accelerator-data-eu | FAIL 400 | — | EU OD | — | Fix query params on data.europa.eu hub API |
| enterprise-europe-network | FAIL 403 | EU | — | Partnering API auth |
| fi-compass-eu | FAIL 404 | — | — | |
| sifted-startups-eu | FAIL 404 | media | — | |
| dealroom | FAIL 403 | no-scrape | — | Commercial |
| eit-raw-kic | FAIL 404 | — | — | |

**Already in repo:** `cordis-eu-research-projects` (enabled), `ukri-gtr-research-projects` (disabled).

### South America (8 probes)

| Candidate | Total≈ | Gate pass≈ | Robots/licence | Est. new | Notes |
|-----------|--------|------------|----------------|----------|-------|
| startups.com.br | 100 | 0% | check | ~100 | Probe picks asset URLs; needs article/company path filter |
| abstartups | 1 | 0% | ABStartups | ~1 | Hub page only |
| corfo-chile | FAIL 404 | gov | — | |
| ruta-n-medellin | FAIL 404 | — | — | |
| startup-chile-alumni | 0 | — | programme | — | `/startups/` empty in HTML |
| wayra-latam | FAIL 404 | corporate | — | |
| argentina-mincyT | FAIL 404 | gov | — | |
| idb-lab-portfolio | 1 | 0% | IDB | ~1 | Listing page only; needs project detail crawl |

---

## 4. Realistic ceilings & attack order

| Region | Realistic catalogue ceiling (12–18 mo) | Rationale |
|--------|----------------------------------------|-----------|
| **Africa** | **8k–15k** programme-selected orgs/solutions | ~2.7k already discoverable on enabled YAML + ~62 baobab + ~47 KCIC news + VC4A/AfDB if approved; double-counting and quality gate may shed 20–40%. |
| **Europe** | **60k+** grant/projects (hidden browse) + **2k–5k** startups if UKRI/Nesta/EIT adapters land | CORDIS dominates; startup media/Dealroom blocked or low yield. |
| **South America** | **3k–8k** | Greenfield; IDB Lab, Startup Chile, Brazil directories, CORFO/Ruta N need verified 2026 URLs and adapters. |

**Suggested order**

1. **Africa ingest backlog** — `startgate-um6p`, `injini`, `afrilabs`, `founders-factory-africa`, `ventures-platform`, `digital-africa` (no new sources).
2. **Africa adapter PR** — baobab + kenya CIC (this report’s draft PR).
3. **Europe** — production ingest `cordis-eu-research-projects` with existing caps; sample + enable `ukri-gtr-research-projects`; fix EU Innovation Radar egress or alternate export.
4. **South America** — spec adapters for IDB Lab + Startup Chile + Startups.com.br after URL audit; keep disabled until 10-sample approval as for Asia.

---

## 5. Compliance

- No candidate YAML entries added or `enabled: true` for new catalogues.
- YC OSS remains **disabled**.
- Norrsken 100: document **401**; do not bypass auth.
