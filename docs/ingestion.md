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
5. **LLM enrichment** — cached by content hash; writes country + `resource_locations`, stage, org, taxonomy links; records `enrichment_attempted_at` so empty LLM responses are not re-billed unless content changes
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
2. **Enrichment backfill** — `ENRICH_BACKFILL_ON_INGEST` (default true): up to `ENRICH_MAX_PER_RUN` (default **15000**) pending rows, parallel (`ENRICH_CONCURRENCY`, default 8), content-hash cache, pauses cleanly on OpenRouter budget errors (`enrichment_paused_budget`)
3. **Embedding backfill** — re-embeds enriched rows in the same run (hash cleared on apply), then catalogue backfill

Manual scripts: `npm run audit:data-quality` (CSV dry-run by default), `npm run enrich:batch`.

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
