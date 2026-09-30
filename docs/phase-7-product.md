# Phase 7 — Curator product bundle

This document ties together features that were previously deferred in `docs/roadmap.md`.

## 1. Collections & Alice notes

- **Schema:** `collections`, `collection_items` (per-resource curator note), `collection_notes` (Alice narrative notes).
- **Web:** `/collections`, `/collections/new`, `/collections/[slug]`.
- **API:** `GET/POST /api/collections`, `POST /api/collections/[slug]/notes`, `POST /api/collections/[slug]/items`.
- **Resource pages:** “Add to collection” control when at least one collection exists.

Run migration after deploy:

```bash
npm run migrate
```

## 2. Admin UI

- **Web `/admin`:** Operational stats and ingest runs (existing page).
- **Gate:** Set `ADMIN_ENABLED=true` on the **web** service. Without it, `/admin` returns 404.
- **Standalone `apps/admin`:** JSON stats on `ADMIN_PORT`; still uses `MCP_AUTH_TOKEN` bearer auth.

## 3. Taxonomy tags (sectors / problems / technologies)

Browse pages and search filters use `resource_sectors`, `resource_problems`, and `resource_technologies`. **Keyword inference** runs on ingest (title, summary, text, adapter tags) via `inferTaxonomyFromText`.

Backfill the full library after deploy:

```bash
npm run backfill:taxonomy:remote
```

This is separate from the optional LLM classifier below (interpretations only).

## 4. Classifier

- **Ingest:** When `CLASSIFIER_ENABLED=true`, new resources get `resource_interpretations` during ingest.
- **Batch backfill:** `npm run classify:batch -- --limit 100` (or `classify:batch:remote`).

**Beelink / local model (development):**

```env
CLASSIFIER_ENABLED=true
CLASSIFIER_BASE_URL=http://127.0.0.1:9888/v1
CLASSIFIER_API_KEY=local
CLASSIFIER_MODEL=local-8b
```

**Production:** Use a hosted OpenAI-compatible endpoint (same pattern as embeddings). Do not point Railway at `127.0.0.1`.

## 5. MCP OAuth (client credentials)

Static `MCP_AUTH_TOKEN` continues to work. Optional OAuth for clients:

```env
MCP_OAUTH_ENABLED=true
MCP_OAUTH_CLIENTS={"cursor":{"secret":"<openssl rand -hex 32>","name":"Cursor"}}
MCP_OAUTH_TOKEN_TTL_SEC=86400
MCP_PUBLIC_URL=https://<mcp-host>
```

- Discovery: `GET /.well-known/oauth-authorization-server`
- Token: `POST /oauth/token` with `grant_type=client_credentials`, `client_id`, `client_secret`
- Use returned `access_token` as `Authorization: Bearer …` on `/mcp`

Tokens are stored hashed in `mcp_access_tokens` until expiry.

## 6. Mechanism diversity

- **Search filter:** `diversity: "mechanism"` (or MCP `explore_problem`, which uses it by default).
- **Logic:** After hybrid fusion, cap at one hit per primary **technology** slug, else **sector**, else `unknown`.
- **Resource detail:** “Different approaches” strip uses mechanism diversity.

Legacy `diverse: true` on search still means **one hit per source**.

## Rollout checklist

1. `npm run migrate` on production DB.
2. Web: `ADMIN_ENABLED=true` if you want `/admin`.
3. MCP: enable OAuth only if you need delegated clients; otherwise keep bearer token.
4. Classifier: enable deliberately (cost/latency); run batch on a subset first.
5. Create a pilot collection in the UI and add a few Alice picks.
