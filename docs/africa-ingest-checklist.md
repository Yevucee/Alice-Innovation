# Africa catalogue ingest checklist

Enabled **Africa innovation** catalogues that ship in the production ingest queue (`scripts/ingest-production-africa-queue.sh`). Same **14 slugs** as `scripts/africa-queue-sources.ts`.

## Prerequisites

- [ ] `main` deployed (web + MCP + ingestor on Railway).
- [ ] `npm run seed` run against production so `sources` matches `config/sources.yaml`.
- [ ] **Only one** production ingest at a time (Postgres advisory lock). Do not overlap `ingest-step*` / other tmux ingests.

## Run the queue

```bash
# Cloud Agent or laptop with Railway CLI + run-with-production-env
npm run ingest:africa:remote
# If the limit pass already finished, run only --full:
npm run ingest:africa-full:remote
# After a mid-queue crash (e.g. ATF hang), finish the tail:
npm run ingest:africa-tail:remote
```

Per source the queue runs:

1. `npm run ingest -- --source <slug> --limit 80`
2. `npm run ingest -- --source <slug> --full`

Broader backfill (thin global catalogues + this queue again) lives in:

```bash
npm run ingest:single-flight:remote
```

## Track completion (14 sources)

| # | Slug | Limit pass | Full pass |
|---|------|:----------:|:---------:|
| 1 | `digital-africa` | ☐ | ☐ |
| 2 | `ghana-climate-innovation-centre` | ☐ | ☐ |
| 3 | `ventures-platform` | ☐ | ☐ |
| 4 | `founders-factory-africa` | ☐ | ☐ |
| 5 | `baobab-network` | ☐ | ☐ |
| 6 | `injini-african-edtech-map` | ☐ | ☐ |
| 7 | `ihub-future-of-learning` | ☐ | ☐ |
| 8 | `oceanhub-africa` | ☐ | ☐ |
| 9 | `cchub-syndicate` | ☐ | ☐ |
| 10 | `seedstars-africa` | ☐ | ☐ |
| 11 | `africa-tech-festival-startup-hub` | ☐ | ☐ |
| 12 | `norrsken-accelerator` | ☐ | ☐ |
| 13 | `norrsken-100` | ☐ | ☐ |
| 14 | `startgate-um6p` | ☐ | ☐ |

**Done when:** each slug has `item_count > 0` and the latest `ingestion_runs` row for `--full` is `SUCCESS` (or `FAILED` with a documented site limit — see `discovery.notes` in YAML).

### Refresh status from production DB

```bash
npm run check:africa-ingest:remote
npm run check:africa-index:remote   # From Africa homepage section count
npm run ops:coverage:remote         # All enabled sources + backfill gaps
```

### Hygiene

```bash
npm run ops:cleanup-stale-runs:remote
# Stuck RUNNING > 1h:
STALE_RUN_MAX_AGE_HOURS=1 npm run ops:cleanup-stale-runs:remote
```

## Out of scope for this queue

| Category | Examples | Why |
|----------|----------|-----|
| **BLOCKED** | `future-africa`, `vc4a`, `africa-business-heroes`, `villgro-africa` | Terms / bot wall — not crawled |
| **PAUSED** (no enable) | `gitex-africa-supernova`, `startupbootcamp-afritech`, second-pass cohort sources | Enable in YAML + seed before ingest |
| **PAUSED** (metadata only) | `africa-prize`, `afrilabs`, … | No verified public catalogue URL yet |

Second-pass sources are defined in `scripts/setup-africa-rollout.ts`; enable deliberately, then add to a custom queue or ingest manually.

## Verify in the product

1. Sign in to production web → Discover → **From Africa** shows cards (not empty).
2. Search for a known portfolio company from `digital-africa` or `ventures-platform`.
3. `npm run smoke:production:remote`

See also `docs/enabling-paused-sources.md` and `docs/railway-checklist.md`.
