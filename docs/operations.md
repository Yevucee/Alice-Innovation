# Operations

## Logs

Processes write one JSON object per line: `time`, `severity`, `service`, `event`, and ids such as `source_id`, `run_id`, or `resource_id`. Tokens, API keys, and authorization headers are not logged.

## Runs

`ingestion_runs` records discovered, fetched, new, updated, unchanged, and failed counts. `ingestion_errors` keeps the URL, stage, HTTP status, and message. Read them with `get_source_status` or SQL. Do not rely only on Railway logs.

## Lock

A session advisory lock stops a second ingestor from starting while one is running. The second process logs `ingest_skipped` and exits 0 **without** running post-ingest maintenance (enrichment, re-embed, org repair), so overlapping cron/manual runs do not record spurious zero-count backfills.

After deploy **#46** (migration `010_post_deploy_jobs`), each ingest run can advance the post-deploy queue within a time budget (`POST_DEPLOY_JOBS_MAX_MINUTES`, default 30). Progress lives in `post_deploy_jobs` (`progress`, `progress.last_run` per runner session). Logs emit `post_deploy_job_run_summary` (one line per job) and `post_deploy_jobs_run_complete`.

**Cleanup-only:** `npm run start:ingestor -- --cleanup-only` runs the post-deploy queue (30-minute budget) and post-ingest maintenance **without** catalogue ingest. Use this to drain NEEDS_REVIEW / org recovery without a 2-hour crawl.

**Post-deploy before ingest (default):** When any post_deploy job is pending, or the run is manual (Railway one-off without `RAILWAY_CRON=1`), cleanup runs **before** ingest. You can also pass `--post-deploy-first` on **Run now**. Opt out with `POST_DEPLOY_BEFORE_INGEST=false` or `--post-deploy-after-ingest`.

Disable the queue with `POST_DEPLOY_JOBS_ON_INGEST=false` once all jobs show `completed`. Admin shows `updated_at`, `last_error`, and `progress.last_run` (minutes, steps, offset before/after, stop reason).

## Access

Do not bypass login, paywalls, CAPTCHA, or bot walls. Engineering for Change is `BLOCKED` for that reason. Sources without an adapter stay `PAUSED` and `enabled: false`, so the cron does not call them.

`source_candidates` holds URLs you add from the admin panel (tech hubs, awards, directories). Use **Add to ingest list** to create an enabled `PARTIAL` source plus a generic html-catalogue adapter config in the database (and append to `config/sources.yaml` when the app can write it). Promoted sources join the normal ingest rotation on the next run.

## Review

New resources are `AUTO_INGESTED`. Search does not require review. Possible duplicates stay as separate resources with a `duplicate_candidates` row.

## Admin

`apps/admin` listens but returns 404 until `ADMIN_ENABLED=true`, and then requires the MCP bearer token. The maintenance UI is Phase 7.

## Cost

Leave the classifier off. Skip embeddings until a key is configured if you only need keyword search. Sample with `--limit` before `--full`. Request rates are in `config/sources.yaml`.

## Production smoke test

From a machine with Railway env (or Cloud Agent):

```bash
npm run smoke:production:remote
npm run ops:cleanup-stale-runs:remote   # optional; closes RUNNING runs older than 2h
```

## Tests before a source change

```bash
npm test
```

Parser fixtures live in `tests/fixtures`. The 25-question search set is Phase 8 and is not in this delivery. `tests/unit/characteristics.test.ts` checks the first five parsers and the per-source cap.
