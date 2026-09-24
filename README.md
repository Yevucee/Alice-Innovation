# Alice Innovation Library

Private intelligence library for 61 approved innovation sources. Postgres stores source facts separately from any AI interpretation. A stateless MCP server exposes read-only search. An ingestor cron fetches sources and exits.

This repository does not contain the Alice sales funnel.

## Layout

- `apps/mcp` — Streamable HTTP MCP at `/mcp`, plus unauthenticated `/health`
- `apps/ingestor` — adapter pipeline
- `apps/admin` — skeleton; routes stay closed unless `ADMIN_ENABLED=true`
- `packages/database` — parameterised SQL via `pg`
- `packages/shared` — URL canonicalisation, hashing, dedupe, RRF
- `packages/source-registry` — loader for `config/sources.yaml`
- `packages/taxonomy` — seed taxonomy
- `database/migrations` — pgvector, weighted `tsvector`, provenance tables
- `docs/` — architecture, sources, ingestion, MCP, deployment, operations

## Requirements

- Node.js 20 or newer
- PostgreSQL with the `vector` extension (Railway pgvector template in production)
- No Redis, no queue, no Prisma

## Local setup

```bash
npm install
cp .env.example .env
# set DATABASE_URL and MCP_AUTH_TOKEN
npm run migrate
npm run seed
```

### Sample ingest

Seeds must be loaded first. A limit keeps the run small. One failed source does not stop the others.

```bash
npm run ingest -- --source project-drawdown --limit 3
npm run ingest -- --source solar-impulse --limit 2
npm run ingest -- --source mit-solve --limit 2
npm run ingest -- --source springwise --limit 2
```

`--full` continues a checkpointed backfill. Without `--full`, disappearance is not applied. Engineering for Change is registered and blocked: the adapter refuses the Cloudflare bot wall.

```bash
npm run ingest -- --source engineering-for-change --limit 1
```

The scheduled path, with no flags, ingests enabled sources that are due and then exits:

```bash
npm run ingest -- --due
```

### MCP server

```bash
npm run mcp
```

`GET http://127.0.0.1:8080/health` returns `{"status":"ok"}` with no token.

Authenticated tools use `Authorization: Bearer $MCP_AUTH_TOKEN` on `POST /mcp` (Streamable HTTP, no legacy SSE endpoint).

Embeddings are optional. Without `EMBEDDING_API_KEY`, ingest still stores records and search uses full text. Set `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, and `EMBEDDING_DIMENSIONS`. The default model is `text-embedding-3-small` at 1536 dimensions. A local OpenAI-compatible server can be pointed at from `.env` for development; do not hard-code it.

`CLASSIFIER_ENABLED` defaults off. Search never calls a chat model.

## Tests

```bash
npm test
```

Unit tests do not need a database. If `DATABASE_URL` is set, the integration test applies migrations and checks bearer rejection plus `get_library_stats`.

## First five sources

| Source | Status |
| --- | --- |
| Solar Impulse | PARTIAL — sitemap plus ng-state JSON |
| Engineering for Change | BLOCKED — Cloudflare bot wall, parser fixture only |
| MIT Solve | PARTIAL — sitemap `/solutions/{id}` pages |
| Springwise | PARTIAL — homepage listing cards; article URLs returned 403 |
| Project Drawdown | ACTIVE — Explorer HTML |

The other 56 sources are in the registry as `PAUSED` with discovery notes. See `docs/sources.md`.
