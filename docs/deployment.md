# Deployment

Deploy from GitHub to Railway. Do not put secrets in the repo.

## Database

Create the Railway Postgres service from the **pgvector** template, not plain Postgres. The first migration runs `CREATE EXTENSION vector`. Copy `DATABASE_URL` into the MCP and ingestor services.

## MCP service

Root config file: `railway.toml`.

- Start command: `npm run start:mcp`
- Health check: `/health`
- Suggested size: 0.5 vCPU, 512 MB RAM

Environment:

- `DATABASE_URL`
- `MCP_AUTH_TOKEN` (long random value)
- `AUTH_MODE=token`
- `EMBEDDING_BASE_URL=https://openrouter.ai/api/v1` (hosted; Railway cannot reach `127.0.0.1`)
- `EMBEDDING_API_KEY` (OpenRouter key)
- `EMBEDDING_MODEL=openai/text-embedding-3-small`
- `EMBEDDING_DIMENSIONS=1536`
- `CLASSIFIER_ENABLED=false`
- `INGESTION_USER_AGENT`
- `ADMIN_ENABLED=false`

After the first deploy, run migrations and the source seed once from a shell in the service, or from a trusted machine that can reach the database:

```bash
npm run migrate
npm run seed
```

## Ingestor service

Same repo, second service, config `railway.ingestor.toml`.

- Start command: `npm run start:ingestor -- --due`
- Cron: `0 4 * * *` (04:00 UTC daily; the process decides which update classes are due)
- Restart policy: never (a finished cron should not loop)
- Suggested size: 1 vCPU, 1 GB RAM

Use the same database URL and embedding variables. Do not set a public domain on the ingestor.

### Embedding backfill

After setting `EMBEDDING_*` on MCP or ingestor, embed existing catalogue rows (batched, resumable):

```bash
npm run backfill:embeddings -- --limit 10    # smoke test (runs 10-row safety check first)
npm run backfill:embeddings                  # full catalogue
```

From a laptop with Railway env: `npm run backfill:embeddings:remote -- --limit 10`

The **ingestor cron** also runs embedding backfill after each ingest pass when `EMBEDDING_BACKFILL_ON_INGEST` is not `false` (default: on). Cap per run: `EMBEDDING_BACKFILL_MAX_PER_RUN` (default `20000`). A 10-row OpenRouter safety check runs first; failures are logged and do not fail ingestion.

`EMBEDDING_PROVIDER` is ignored; only `EMBEDDING_BASE_URL` selects the API host (OpenRouter in production).

### Card images (one-off backfill)

Thumbnails come from `source_items.image_url` during ingest. After deploying image-parsing changes, re-fetch items from the **alice-mcp** Railway shell (private DB + embeddings):

```bash
npm run ingest:production-backfill-images
npm run check:image-coverage
```

See `docs/railway-checklist.md` for limits per source and smoke checks.

## Web service

Config file: `railway.web.toml`.

- Build: `npm ci && npm run web:build`
- Start: `npm run start:web`
- Health check: `/login` (200 without auth)
- Suggested size: 0.5 vCPU, 512 MB RAM

Environment (in addition to `DATABASE_URL`):

- `WEB_SESSION_SECRET` (long random; not the MCP token in client code)
- `WEB_AUTH_PASSWORD` (team sign-in password)
- `WEB_PORT` (Railway sets `PORT`; Next reads `WEB_PORT` — set `WEB_PORT=$PORT` or rely on default 3000 if Railway maps correctly)
- Same four `EMBEDDING_*` variables as MCP (required for hybrid search in the UI)

Restrict the public URL (VPN, Railway private networking, or IP allowlist). Session cookies protect routes; this is not anonymous public data.

After deploy, run migrations and seed if the database is new (same as MCP). Ingest via the ingestor service or a one-off shell.

## Path

Branch to GitHub, then Railway builds from the connected repo. `main` is the production branch after review. No second database, no Redis, no worker queue.
