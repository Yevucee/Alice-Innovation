# Deployment

Deploy from GitHub to Railway. Do not put secrets in the repo.

## Database

Create the Railway Postgres service from the **pgvector** template, not plain Postgres. The first migration runs `CREATE EXTENSION vector`. Copy `DATABASE_URL` into the MCP and ingestor services.

## Railway dashboard (current)

Railway may **ignore** repo `railway*.toml` files. Configure each service in the **Railway dashboard** (build command, start command, health check, cron, restart policy). The toml files in this repo are reference only.

## MCP service

Reference config: `railway.toml`.

- Start command: `npm run start:mcp`
- Health check: `/health`
- Suggested size: 0.5 vCPU, 512 MB RAM

Environment:

- `DATABASE_URL`
- `MCP_AUTH_TOKEN` (long random value)
- `AUTH_MODE=token`
- `EMBEDDING_BASE_URL` (hosted; Railway cannot reach `127.0.0.1`)
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL=text-embedding-3-small`
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

## Web service

Reference config: `railway.web.toml`.

- Build: `npm run web:build` (Railway runs `npm ci` / install before build — do not duplicate `npm ci` in the build command)
- Start: `npm run start:web`
- Health check: `/login` (200 without auth)
- Suggested size: 0.5 vCPU, 512 MB RAM

Environment (in addition to `DATABASE_URL`):

- `WEB_SESSION_SECRET` (long random; not the MCP token in client code)
- `WEB_AUTH_PASSWORD` (team sign-in password)
- `WEB_PORT` (Railway sets `PORT`; Next reads `WEB_PORT` — set `WEB_PORT=$PORT` or rely on default 3000 if Railway maps correctly)
- Same `EMBEDDING_*` as MCP if you want hybrid search in the UI

Restrict the public URL (VPN, Railway private networking, or IP allowlist). Session cookies protect routes; this is not anonymous public data.

After deploy, run migrations and seed if the database is new (same as MCP). Ingest via the ingestor service or a one-off shell.

## Path

Branch to GitHub, then Railway builds from the connected repo. `main` is the production branch after review. No second database, no Redis, no worker queue.
