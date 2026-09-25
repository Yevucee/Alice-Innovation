# Railway deploy checklist

Use one Railway **project** with four services: **Postgres (pgvector)**, **MCP**, **ingestor**, **web**. Same GitHub repo `Yevucee/Alice-Innovation`, branch `main` after merge.

## 0. Prerequisites

- [ ] GitHub repo connected to Railway
- [ ] `RAILWAY_TOKEN` or `railway login` on your machine for CLI deploys
- [ ] Hosted **embeddings** endpoint (OpenAI or compatible). Do not use `127.0.0.1` on Railway.

## 1. Database

- [ ] New service → **PostgreSQL** template with **pgvector** (not plain Postgres)
- [ ] Copy `DATABASE_URL` (private network URL is fine for sibling services)

## 2. MCP service

- [ ] Add service from repo; config file: **`railway.toml`**
- [ ] Start: `npm run start:mcp`
- [ ] Health: `/health`
- [ ] Public domain (for remote MCP clients)

Variables:

```env
DATABASE_URL=<from pgvector service>
MCP_AUTH_TOKEN=<openssl rand -hex 32>
AUTH_MODE=token
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=<secret>
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
CLASSIFIER_ENABLED=false
INGESTION_USER_AGENT=AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)
ADMIN_ENABLED=false
```

One-time (Railway shell on MCP or laptop with DB access):

```bash
npm run migrate
npm run seed
```

- [ ] `curl https://<mcp-host>/health` → `{"status":"ok"}`

## 3. Ingestor service

- [ ] Second service; config: **`railway.ingestor.toml`**
- [ ] Cron: `0 4 * * *` (if not in toml)
- [ ] **No** public domain
- [ ] Same `DATABASE_URL` and `EMBEDDING_*` as MCP

Optional first run (shell):

```bash
npm run ingest -- --source project-drawdown --limit 20
```

### Card thumbnails (`image_url`)

Search cards and resource pages read `source_items.image_url` (filled by the ingestor from `og:image` and source-specific HTML). **Deploying new image-parsing code does not backfill existing rows** until those URLs are fetched again.

After any deploy that changes image extraction (or the first time you enable thumbnails):

1. Run from **`alice-mcp` Railway shell** (private `DATABASE_URL` + `EMBEDDING_*`), **or** from a Cursor Cloud Agent / laptop with `RAILWAY_API_TOKEN` and the Railway CLI:

```bash
# Cloud Agent / local (TCP proxy to pgvector + MCP env vars)
bash scripts/run-with-production-env.sh npm run ingest:production-backfill-images
```

Inside Railway **alice-mcp** shell only:

```bash
bash scripts/ingest-production-backfill-images.sh
# or: npm run ingest:production-backfill-images
```

3. Check coverage:

```bash
npm run check:image-coverage
```

4. In the web app, open **Search** and confirm cards show photos instead of letter placeholders.

**Ongoing:** the ingestor cron (`0 4 * * *` UTC) gradually refreshes due sources. For a full catalogue pass, use `npm run ingest -- --source <slug> --full` in a shell (respect rate limits; monitor logs).

Smaller batch ingest (initial library seed without the image-focused limits) remains:

```bash
bash scripts/ingest-production-step1.sh
```

## 4. Web service

- [ ] Third app service; config: **`railway.web.toml`**
- [ ] Build: `npm ci && npm run web:build`
- [ ] Start: `npm run start:web`
- [ ] Health: `/login`
- [ ] Domain restricted (team VPN / allowlist recommended)

Variables:

```env
DATABASE_URL=<same>
WEB_SESSION_SECRET=<openssl rand -hex 32>
WEB_AUTH_PASSWORD=<team password — share with Alice users only>
PORT=<Railway injects; Next uses PORT via start script>
EMBEDDING_BASE_URL=...
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

- [ ] Open `https://<web-host>/login`, sign in, confirm Discover shows resources after ingest

## 5. Cursor Cloud Agent (optional)

- [ ] Cursor Project linked to **Alice-Innovation** only
- [ ] Environment uses `.cursor/environment.json` (ports 3000, 8080)
- [ ] `WEB_AUTH_PASSWORD` in generated `.env` after first boot

## 6. Smoke tests

- [ ] MCP: `search_library` / `get_library_stats` with bearer token
- [ ] Web: search + open a resource + sources page
- [ ] Web: search cards show thumbnails where sources expose images (run image backfill once after deploy if needed)
- [ ] Ingestor: one cron run or manual `npm run ingest -- --due` in shell
- [ ] Images: `npm run check:image-coverage` on MCP shell shows non-zero `with_image` for ingested sources

## 7. Secrets hygiene

- [ ] No secrets in git
- [ ] Rotate `MCP_AUTH_TOKEN` and `WEB_AUTH_PASSWORD` if ever leaked
- [ ] MCP token never stored in browser localStorage (web uses session cookie only)
