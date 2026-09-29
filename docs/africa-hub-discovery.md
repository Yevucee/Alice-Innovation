# Africa hub discovery phase

Build an internal directory of African innovation hubs, incubators, accelerators, makerspaces, FabLabs, university innovation centres, and ecosystem organisations. Discover which hubs can become **innovation-ingestion sources**.

## Directory sources (priority order)

| # | Slug | Role | Status |
|---|------|------|--------|
| 1 | `afrilabs` | INGESTION | **Live** — WP REST `hub` post type (~500+ members) |
| 2 | `ghana-hubs-network` | DISCOVERY_ONLY | **Live** — seed GHN members + named supplements |
| 3 | `isn-nigeria` | DISCOVERY_ONLY | **Live** — curated `config/hub-isn-directory.yaml` (SPA site) |
| 4 | `startup-uganda` | DISCOVERY_ONLY | Stub — URL TBD |
| 5 | `impact-hub-global` | DISCOVERY_ONLY | **Live** — `config/hub-impact-hub-africa.yaml` |
| 6 | `fablabs-io` | INGESTION | **Live** — `https://www.fablabs.io/api/labs` (Africa filter) |
| 7 | `orange-digital-centers` | DISCOVERY_ONLY | Stub |
| 8 | `egypt-tiec` | DISCOVERY_ONLY | Stub |
| 9 | `global-innovation-gathering` | DISCOVERY_ONLY | Stub |
| 10 | `briter` | RESEARCH_ONLY | Never scrape paid datasets |
| 11 | `vc4a` | MANUAL_ONLY | No automated ingest without verified API/RSS |

First-class hubs are also listed in `config/hub-seed-organisations.yaml` (MEST, CcHUB, iHub, etc.).

## Schema (migration `004_africa_hub_discovery`)

- **`organisations`** — `city`, `hub_subtype`, `is_innovation_hub`, `website_host` (dedupe), `hub_metadata`
- **`hub_directories`** — registry of directory sources
- **`hub_directory_discoveries`** — provenance per org per directory
- **`organisation_network_memberships`** — e.g. AfriLabs, Ghana Hubs Network
- **`innovation_source_candidates`** — proposed `sources.yaml` entries after catalogue + robots checks

## Pipeline (per hub)

1. Upsert **ORGANISATION** (dedupe by `website_host`, then by name slug).
2. Record **directory discovery** + network memberships.
3. Optional: **probe** homepage for portfolio/directory links → `catalogue_capability`.
4. Optional: **robots** check on official site.
5. Create **source_candidate** when capability is not `NONE` or a portfolio source already exists.
6. Optional: **`--link-portfolios`** — link ingested resources to hub org (`INCUBATED_BY`, `ACCELERATED_BY`, `FUNDED_BY`, `SHOWCASED_AT`) using seed `linked_portfolio_source`.

## Commands

```bash
npm run migrate

# Seed list only + link existing portfolio sources
npm run hubs:discover -- --directories seed-organisations --link-portfolios

# AfriLabs (full — ~500 hubs, slow)
npm run hubs:discover -- --directories afrilabs

# FabLabs in Africa
npm run hubs:discover -- --directories fablabs-io

# Production
npm run hubs:discover:remote -- --directories seed-organisations,afrilabs,fablabs-io --link-portfolios
```

Use `--limit 50` while testing. Add `--probe` and `--robots` for access verification before promoting candidates to `config/sources.yaml`.

### Website enrichment & reprobe

AfriLabs profiles rarely list external URLs in HTML. Merge websites from **name-matched** seed/FabLabs peers, then reprobe candidates:

```bash
npm run hubs:enrich -- --match-names --reprobe --limit 200
npm run hubs:enrich:remote -- --match-names --reprobe --limit 200
```

### AfriLabs as library source

`afrilabs` is **enabled** in `config/sources.yaml` (WP REST `hub` → `ORGANISATION` resources). Run `npm run seed` then `npm run ingest -- --source afrilabs --limit 80` after deploy.

## Promoting to ingestion

1. Review `innovation_source_candidates` and robots/ToS notes.
2. Add adapter + `config/sources.yaml` entry (existing ingest pipeline).
3. Set `linked_source_slug` / enable source — do **not** enable VC4A without permission.

## Target

Map the **long tail** across African countries and secondary cities, not only well-known hubs. Re-run discovery after adding directory adapters.
