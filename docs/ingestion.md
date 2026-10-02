# Ingestion

## Adapter interface

Each adapter implements `discover`, `fetch`, and `parse`. Adapters return a normalised draft; they do not import the database or call `upsertDraft` directly.

Discovery order used by the first adapters: sitemap when it lists item URLs, otherwise HTML list pages. Playwright is not a dependency.

## Canonical per-item pipeline (required)

Every ingest entry point (`npm run ingest` with `--due`, `--source`, resume/hub/Africa scripts that invoke the ingestor) must process each parsed item through **`processIngestItem`** in `apps/ingestor/src/item-pipeline.ts`. Adapters must not bypass this module.

Ordered steps:

1. **Parse** — adapter `parse(page)` → `NormalisedDraft`
2. **Prepare** — `prepareIngestDraft` (`geo-defaults` + `inferCountryFromText`)
3. **Quality gate** — `evaluateDraftQuality` → may set `NEEDS_REVIEW`; skips org/person links when flagged
4. **Upsert** — `upsertDraft` (resources + source_items; no deletes)
5. **LLM enrichment (optional on ingest)** — `ENRICH_ON_INGEST` (default **false**). When false, country/stage/org LLM + supplemental page fetch run in **post-ingest enrichment backfill** (concurrent, time-capped via `ENRICH_MAX_MINUTES`, cost-capped). When true, same logic runs inline per changed item (slow for large catalogues). Cached by content hash; LLM JSON may be a one-element array (normalized to the first object). Records `enrichment_attempted_at` so empty LLM responses are not re-billed unless content changes.
6. **Taxonomy link** — `inferTaxonomyFromText` + `linkResourceTaxonomy`
7. **Embedding** — `buildEmbeddingText` (includes enriched fields) + `saveEmbedding`
8. **Classifier** (optional) — `classifyResource` when `CLASSIFIER_ENABLED=true`

`--dry-run` still parses and logs items but does not upsert or run post-steps on rows.

## Cron / CLI

`npm run ingest` loads `config/sources.yaml` (seeded sources).

- `--due` runs enabled sources whose update class is due. Default when no `--source` is passed.
- `--source <id>` runs that source even if paused/blocked.
- `--limit <n>` stops after *n* items.
- `--full` uses `backfill_checkpoints` and may deactivate missing catalogue URLs (full-catalogue adapters only).
- `--dry-run` parses only.

One advisory lock prevents overlapping runs.

## Post-ingest maintenance (every ingest run)

After all sources finish, the ingestor runs (failures are logged; ingest status is not failed):

1. **Quality audit** — `QUALITY_AUDIT_ON_INGEST` (default true): scans **all active** resources each run → sets `NEEDS_REVIEW`
2. **Enrichment backfill** — `ENRICH_BACKFILL_ON_INGEST` (default true): up to `ENRICH_MAX_PER_RUN` (default **15000**) pending rows, parallel (`ENRICH_CONCURRENCY`, default 8), wall-clock cap `ENRICH_MAX_MINUTES` (default **90**), content-hash cache **including supplemental page text** when `enrichment_page_cache` has body text; rows missing country/stage are retried after supplemental fetch even when an earlier attempt used an empty supplemental hash. Logs `enrich_backfill_progress` every `ENRICH_PROGRESS_EVERY` rows, `gaps: …`, `supplemental_pages_fetched`, `country_applied`, `stage_applied`, `llm_array_unwraps`, and cost in `enrichment_backfill_runs` (cap `ENRICH_MAX_COST_USD`, default **$3**).
3. **Embedding backfill** — re-embeds enriched rows in the same run (hash cleared on apply), then catalogue backfill

Manual scripts: `npm run audit:data-quality` (CSV dry-run by default), `npm run enrich:batch`, `npm run adapter:sample-dry-run -- --source=<id>` (discover/parse up to 10 items per source without DB writes).

## Africa scraper quality (Oct 2026)

Structured catalogue parsers live in `apps/ingestor/src/adapters/catalogue-parse-helpers.ts` (shared title resolution: visible `h1` → JSON-LD → Open Graph → document title). Cohort second-pass adapters use Webflow/CMS cards (`.w-dyn-item`, table rows) instead of raw `h2`/`li`/`p` noise.

**Second-pass ingest** (`ingest:africa-second-pass:remote`) currently targets only:

- `su-launchlab` (iframe portfolio pages; `resolveCatalogueTitle`)
- `kenya-climate-innovation-centre` (HTML catalogue + sitemap)
- `global-startup-awards-africa` (structured cohort cards on `/former-winners`)

**Disabled until a structured parser exists** (still registered; placeholder adapter if forced with `--source`):

- `kosmos-innovation-centre-ghana`
- `africa-tech-summit-showcase`
- `mest-africa-challenge`
- `milken-motsepe-innovation-prize`
- `flat6labs-africa`
- `growthafrica`
- `africarena`
- `africa-fintech-summit-alpha-expo`

Legacy cohort junk (`rawMetadata.cohort_source`, title equals summary, boilerplate titles) is flagged `NEEDS_REVIEW` via the quality gate and post-ingest quality audit.

Fixtures for parser regressions: `tests/fixtures/*` and `tests/unit/africa-parser-quality.test.ts`.

## Card images / thumbnails

`source_items.image_url` powers search cards. Parsers set `draft.imageUrl` via `resolvePageImageUrl` (Open Graph, Twitter card, JSON-LD `logo`/`image`, then main/article `<img>`). Listing-only adapters use `listingCardImageUrl`.

- **Coverage report**: `npm run check:image-coverage` (active `source_items` and resources with any linked thumbnail)
- **Backfill**: `npm run backfill-images-from-db -- --source <slug> [--limit N] [--validate]` re-fetches canonical URLs; `--validate` runs a HEAD probe (`IMAGE_MIN_BYTES`, default 256)
- **Listing cards**: `npm run backfill:listing-card-images -- --source <slug>`
- **Post-ingest**: `IMAGE_BACKFILL_ON_INGEST` (default true) backfills missing images for resources touched in the run (`IMAGE_BACKFILL_MAX_PER_RUN`, default 150)

Production one-shot: `npm run ingest:production-backfill-images:remote` (runs sample ingests + coverage before/after).

## Post-deploy job queue (Railway Run now)

Migration `010_post_deploy_jobs.sql` seeds one-time jobs in `post_deploy_jobs`. After each normal ingest (`Run now` on **alice-ingestor**), post-ingest runs **at most one step** of the earliest pending job (`POST_DEPLOY_JOBS_ON_INGEST`, default true). Failures are logged and never fail the ingest run.

| Order | job_key | Purpose |
| --- | --- | --- |
| 1 | `scraper_reingest_202510` | Re-ingest fixed sources (limit 40, then capped full passes per source) |
| 2 | `cohort_quality_audit_202510` | One-time `runQualityAudit` with `apply=true` for legacy cohort junk |
| 3 | `bulk_image_backfill_202510` | Listing-card + validated page image backfill in capped batches |

Re-ingest source list: `su-launchlab`, `kenya-climate-innovation-centre`, `global-startup-awards-africa`, `norrsken-100`, `norrsken-accelerator`, `oceanhub-africa`, `africa-tech-festival-startup-hub`.

Tune caps with `POST_DEPLOY_REINGEST_ITEMS_PER_RUN`, `POST_DEPLOY_FULL_PASSES_PER_SOURCE`, `POST_DEPLOY_IMAGE_BACKFILL_PER_RUN`. When all jobs are `completed`, only the usual post-ingest maintenance runs.

## Quality review

`resources.review_status` includes `NEEDS_REVIEW`. Homepage “Recently added” / “From Africa” use `qualityBrowse` filters (exclude `NEEDS_REVIEW`, require summary length).

## Embeddings and classification

Embeddings use OpenAI-compatible `POST /embeddings` (OpenRouter in production). Indexed text is built with `buildEmbeddingText`. Re-embedding happens when `embedding_content_hash` changes (including after enrichment).

Enrichment uses OpenRouter chat (`ENRICH_MODEL`, default `google/gemini-2.5-flash-lite`) with `ENRICH_API_KEY` or `EMBEDDING_API_KEY`.

The classifier writes only to `resource_interpretations` and treats source HTML as untrusted.

## First adapters

| Adapter | Discover | Parse |
| --- | --- | --- |
| `solar-impulse` | English solution URLs in the sitemap | `script#ng-state` solution object |
| `mit-solve` | `/solutions/{id}` in the sitemap | `h1`, summary, profile answers |
| `project-drawdown` | Links on `/explorer` | title field, `.field-summary` |
| `springwise` | `.tile-post` cards on the homepage | card title; article HTML when allowed |
| `engineering-for-change` | stops on the bot wall | fixture parser for title and summary |

Page text is stripped of scripts before storage; stored text is capped.
