# Ingest scopes

Scoped runs isolate regional catalogues from grant/research sources so a manual Asia or Africa run is not consumed by Climate KIC or MIT Solve.

## Environment and CLI

| Variable | Default | Purpose |
|----------|---------|---------|
| `INGEST_SCOPE` | `all` | `asia`, `africa`, `europe`, `south-america`, `grants`, `all`, `failed-only` |
| `INGEST_SCOPE_MAX_MINUTES` | `90` | Time budget for any scoped run where `INGEST_SCOPE` ≠ `all` |
| `INGEST_TRIGGER` | inferred | `admin-button`, `cron`, or `manual` (recorded on each `ingestion_runs.error_summary`) |
| `INGEST_SOURCE_LOOP_MAX_MINUTES` | `60` | Global budget when `INGEST_SCOPE=all` (nightly cron) |

CLI: `npm run ingest -- --scope asia`

Admin buttons enqueue `ingest_requests` and call Railway GraphQL **`deploymentInstanceExecutionCreate`** on the ingestor **service instance** (cron “run now”). A plain `serviceInstanceDeploy` on a cron service builds an image but does **not** run the start command until the schedule fires ([Railway cron docs](https://docs.railway.com/cron-jobs), [community confirmation](https://station.railway.com/questions/how-to-initialize-a-railway-cron-service-3e24592b)).

The ingestor claims pending rows only when:

- `RAILWAY_CRON` is **not** set (nightly cron never claims admin requests), and
- the request is **newer than 15 minutes**.

Stale `pending` / `running` rows auto-fail (`expired_pending` / `expired_running`) so Admin buttons cannot stay blocked forever.

Persistent Railway service variables are not changed.

## Run order for `all`

1. asia  
2. africa  
3. europe  
4. south-america  
5. grants (general-innovation, climate, agriculture, people, major-backed, education, solutions-journalism)

## Source → scope mapping

Implemented in `apps/ingestor/src/ingest-scope.ts` (`primaryIngestScopeForSource`).

| Scope | Rule |
|-------|------|
| **asia** | `category: asia-innovation` |
| **africa** | `category: africa-innovation` |
| **europe** | Source id or adapter prefix: `cordis-*`, `eu-innovation-radar`, `ukri-gtr-*` |
| **south-america** | Explicit slug set `SOUTH_AMERICA_SOURCE_IDS` (empty until SA catalogues are enabled) |
| **grants** | Categories: `general-innovation`, `agriculture-water-development`, `climate-energy-nature`, `people-innovators`, `major-backed-ideas`, `education-government-design`, `solutions-journalism` |
| **unmapped** | Any other category → treated as **grants** for filtering; listed by `listUnmappedSourceIds()` in tests |

Regenerate the unmapped slug list:

```bash
npx tsx -e "import { loadSources } from './packages/source-registry/src/load.ts'; import { listUnmappedSourceIds } from './apps/ingestor/src/ingest-scope.ts'; console.log(listUnmappedSourceIds(loadSources()).join('\n')||'(none)');"
```

## `failed-only`

Runs only sources whose **latest** `ingestion_runs` row is `FAILED`, or `PARTIAL_SUCCESS` with `items_failed > 0`.

## Expected duration (production ballpark)

| Scope | Enabled sources (Oct 2026) | Typical budget |
|-------|---------------------------|----------------|
| asia | ~40+ enabled in category | 60–90 min |
| africa | ~20+ enabled | 60–90 min |
| europe | Mostly disabled open-data; cordis when on | 30–90 min |
| south-america | 0 enabled | minutes |
| grants | ~35 non-regional | 60–90 min (often hits budget on one large catalogue) |
| all (cron) | All enabled | 60 min global cap |
| failed-only | Subset | 30–90 min |
