# Innovation Library web front end

## Reuse map (Stage 1)

| Capability | Canonical implementation | Web exposure |
| --- | --- | --- |
| Hybrid search | `searchLibrary()` in `@alice/database` | `POST /api/search` |
| Diverse results | `SearchFilters.diverse` (per-source cap = 1) | `mode=diverse` on search API |
| Resource detail | `getResource()` | `GET /api/resources/:id` |
| Similar resources | `findSimilar()` | `GET /api/resources/:id/similar` |
| People / organisations | `searchPeople()`, `searchOrganisations()`, `getPerson()`, `getOrganisation()` | `/api/people`, `/api/organisations` |
| Sources catalogue | `browseSources()`, `sourceStatus()` | `/api/sources` |
| Taxonomy | `browseCategories()` | `/api/categories` |
| Library scale | `libraryStats()` | `/api/stats` |
| Query embeddings | `embedTexts()` in ingestor (same as MCP) | Server-only in search route |

MCP tools and the web API both call the same `@alice/database` functions. No duplicate ranking or dedupe logic in React.

## Authentication

Browser sessions use an httpOnly signed cookie (`alice_session`). The MCP bearer token is never sent to client JavaScript. Set `WEB_SESSION_SECRET` and `WEB_AUTH_PASSWORD` (or use the same value as `MCP_AUTH_TOKEN` for a single shared secret in development).

## Running locally

```bash
cp .env.example .env
# DATABASE_URL, MCP_AUTH_TOKEN, WEB_SESSION_SECRET, WEB_AUTH_PASSWORD

npm run migrate
npm run seed
npm run ingest -- --source project-drawdown --limit 5

npm run web
```

Default web port: `3000` (`WEB_PORT`). Cloud Agent environments use `.cursor/environment.json` (ports 3000 and 8080); sign-in password is in `.env` as `WEB_AUTH_PASSWORD`.

Production: `railway.web.toml` and `docs/deployment.md`.

## Deferred (spec stages 6–7)

- Collections and Alice notes (no schema yet)
- Full admin ingestion dashboards (basic stats at `/admin`)
- Mechanism-level `explore_problem` diversity (taxonomy phase; web uses per-source cap today)
