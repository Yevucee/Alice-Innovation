# Roadmap (after V1 production bring-up)

## Completed in ops bring-up

- Railway: pgvector, MCP, ingestor cron, web
- Migrations through `002_resources_embedding_hnsw` (HNSW on `resources.embedding`)
- Step 1–3 ingest scripts; DB-driven image backfill; solar image loop
- Production smoke test: `npm run smoke:production:remote`
- Stale `RUNNING` ingestion run cleanup: `npm run ops:cleanup-stale-runs:remote`

## In progress (long-running)

- **Solar Impulse** `image_url` backfill to 100% (`npm run backfill:solar-images-all:remote`)
- **MIT Solve** checkpointed `--full` catalogue (`npm run ingest:production-step3:remote` or ingestor shell)

## Still deferred (product scope)

- Collections and Alice notes (schema + UI)
- Admin UI with `ADMIN_ENABLED=true` (Phase 7)
- Taxonomy-phase mechanism diversity for `explore_problem`
- 25-question search evaluation set (Phase 8)
- Adapters for 56 `PAUSED` sources in `config/sources.yaml`
- Engineering for Change (BLOCKED — bot wall)
- Springwise depth beyond homepage tiles (article 403s)
- MCP OAuth (static bearer token today)
- Classifier (`CLASSIFIER_ENABLED=false` by design)
- Railway Config-as-Code → Infrastructure-as-Code migration (deadline 2026-12-01)
