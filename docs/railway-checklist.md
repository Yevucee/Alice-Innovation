# Railway deploy checklist

Use one Railway **project** with four services: **Postgres (pgvector)**, **MCP**, **ingestor**, **web**. Same GitHub repo `Yevucee/Alice-Innovation`, branch `main` after merge.

## 0. Prerequisites

- [x] GitHub repo connected to Railway
- [x] `RAILWAY_API_TOKEN` / CLI for deploys and remote ops (`scripts/run-with-production-env.sh`)
- [x] Hosted **embeddings** endpoint (OpenAI or compatible). Do not use `127.0.0.1` on Railway.

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

- [x] `curl https://<mcp-host>/health` → `{"status":"ok"}`

Post-deploy:

```bash
npm run smoke:production:remote
npm run migrate   # on MCP shell or via run-with-production-env
```

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

**Solar Impulse / large catalogues:** prefer DB-driven backfill (re-fetches stored `canonical_url`s, uses `og:image`, no sitemap walk):

```bash
bash scripts/run-with-production-env.sh npm run backfill:images-from-db -- --source solar-impulse --limit 150
```

**Ongoing:** the ingestor cron (`0 4 * * *` UTC) gradually refreshes due sources. For a full catalogue pass, use `npm run ingest -- --source <slug> --full` in a shell (respect rate limits; monitor logs).

Smaller batch ingest (initial library seed without the image-focused limits) remains:

```bash
bash scripts/ingest-production-step1.sh
```

**Step 2 — grow catalogues** (more MIT Solve / Springwise / Drawdown rows; run after step 1):

```bash
bash scripts/run-with-production-env.sh bash scripts/ingest-production-step2-catalogue.sh
```

**Solar images to completion** (loops 100 URLs at a time until done):

```bash
npm run backfill:solar-images-all:remote
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

- [x] Automated: `npm run smoke:production:remote` (health, auth, `tools/list`, `get_library_stats`, DB stats)
- [ ] Manual web: sign in, search, open a resource, sources page
- [x] Images: `npm run check:image-coverage` (run solar loop until solar source is satisfied)
- [x] Ingestor: cron `0 4 * * *` UTC on `alice-ingestor`; manual `npm run ingest -- --due` when testing

See `docs/access.md` for web access restrictions.

## 7. Secrets hygiene

- [ ] No secrets in git
- [ ] Rotate `MCP_AUTH_TOKEN` and `WEB_AUTH_PASSWORD` if ever leaked
- [ ] MCP token never stored in browser localStorage (web uses session cookie only)
