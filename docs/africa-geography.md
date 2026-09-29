# Africa geography in search and filters

## Problem

Most `africa-innovation` catalogue ingests (hub portfolios, accelerators, festival lists) **do not expose country on each HTML page**. Ingest historically stored title/summary only, so:

- `primary_country_code` stayed empty for ~90% of Africa catalogue resources.
- `resource_locations` were never created (locations require a country or continent label at ingest time).
- Search **Continent → Africa** only matched `locations.continent`, so users saw a handful of items while ~1,800+ Africa-catalogue startups existed.

Classification (`classify:batch`) does **not** assign geography; it only fills interpretation fields. Low Africa counts in filters are a **geography tagging** issue, not the classifier.

## Fixes (code)

1. **Ingest defaults** — `applyGeographyDefaults()` tags `africa-innovation` items with continent `Africa`, plus per-source hub defaults (`AFRICA_SOURCE_GEO_DEFAULTS` in `@alice/taxonomy`).
2. **Locations on continent-only** — upsert attaches a location row when only `continentName` is set (label `Africa` when no country).
3. **Search** — continent filter `africa` also includes resources linked to any enabled `africa-innovation` source.
4. **Country names** — expanded African ISO name → code map for metadata backfill (Injini, Norrsken, etc.).

## Ops

After deploy:

```bash
npm run backfill:africa-geography:remote
npm run audit:africa-geography:remote
```

Re-ingest Africa catalogues over time to refresh per-item countries when adapters learn to parse them from pages.

## Before Asia rollout

- Run audit until `africa_source_resources_missing_geo` is near zero.
- Confirm search `continent=africa` filtered total ≈ distinct africa-innovation resources (+ any other tagged items).
- Add `asia-innovation` category with the same default-geo pattern when sources are enabled.
