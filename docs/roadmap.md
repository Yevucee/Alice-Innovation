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

## Phase 7 (curator bundle — see `docs/phase-7-product.md`)

- **Collections & Alice notes** — migration `003_phase7_collections_oauth`, web UI, APIs
- **Admin UI** — `/admin` gated by `ADMIN_ENABLED=true` on web
- **Classifier** — ingest hook + `npm run classify:batch`; off by default in production
- **MCP OAuth** — optional client-credentials (`MCP_OAUTH_ENABLED`); static bearer still supported
- **Mechanism diversity** — `explore_problem` + search `diversity: "mechanism"`

## Still deferred

- 25-question search evaluation set (Phase 8)
- Adapters for remaining `PAUSED` sources in `config/sources.yaml`
- Engineering for Change (BLOCKED — bot wall)
- Springwise depth beyond homepage tiles (article 403s)
- Full OAuth authorization-code flow for MCP (only client-credentials in Phase 7)
- Railway Config-as-Code → Infrastructure-as-Code migration (deadline 2026-12-01)
