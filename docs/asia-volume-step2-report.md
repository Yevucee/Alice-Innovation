# Asia volume step 2 — new high-volume sources

Dry-run: `npx tsx scripts/asia-batch-dry-run.ts --limit=500` on new slugs (2026-10-08).

Government / ecosystem archives (sitemap-backed). **Enabled only after dry-run** (per plan).

## New sources (6 registered)

| Source | Discovered | Expected new | Enabled | Risk |
|--------|------------|--------------|---------|------|
| `edb-singapore-innovation-insights` | **1647** | ~1500 articles (cap 500/run) | yes | Low — EDB sitemap |
| `startupsg-events-archive` | **925** | ~900 events | yes | Med — events, not companies |
| `imda-innovation-blog` | **233** | ~230 | yes | Low |
| `taiwan-startup-stadium-founder-stories` | 6 | ~6 | yes | Low volume founder stories |
| `enterprisesg-innovation-startup-blog` | FAIL 403 | 0 | **no** | Bot wall from egress |
| `designsingapore-impact-stories` | 1 | 0 | **no** | WP catalogue nearly empty |

### Sample titles (dry-run limit 15)

**`edb-singapore-innovation-insights`:** Singapore EDB (listing pages; enrich for headline).

**`imda-innovation-blog`:** From data to durians: H2O.ai’s journey to AI-led accessibility; plus 232 more blog slugs in sitemap.

**`startupsg-events-archive`:** Echelon Asia Summit, Innovfest Unbound, Future Food Asia, SYNC (event slugs from `/events/{id}/…`).

**`taiwan-startup-stadium-founder-stories`:** 台灣新創競技場部落格 (6 founder-story URLs).

## Not added (blocked from egress)

| Candidate | Reason |
|-----------|--------|
| Wikidata Asia startups | SPARQL timeout / 502 |
| Startup India registry search | Handlebars SPA; live 403 |
| MDEC / data.gov.my | 403 |
| Red Dot / iF / G-Mark winners | 403/404 or JS-only |
| EnterpriseSG blog | HTTP 403 |

## Usage

```bash
npx tsx scripts/append-asia-high-volume-sources.ts   # idempotent append to sources.yaml
INGEST_ONLY_SOURCES=edb-singapore-innovation-insights,startupsg-events-archive,imda-innovation-blog INGEST_FULL=true
```

Combine with step 1 (`hub71-startup-directory`, `hkstp-company-directory`) for largest company-level gains.
