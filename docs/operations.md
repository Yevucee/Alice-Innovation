# Operations

## Logs

Processes write one JSON object per line: `time`, `severity`, `service`, `event`, and ids such as `source_id`, `run_id`, or `resource_id`. Tokens, API keys, and authorization headers are not logged.

## Runs

`ingestion_runs` records discovered, fetched, new, updated, unchanged, and failed counts. `ingestion_errors` keeps the URL, stage, HTTP status, and message. Read them with `get_source_status` or SQL. Do not rely only on Railway logs.

## Lock

A session advisory lock stops a second ingestor from starting while one is running. The second process logs `ingest_skipped` and exits 0.

## Access

Do not bypass login, paywalls, CAPTCHA, or bot walls. Engineering for Change is `BLOCKED` for that reason. Sources without an adapter stay `PAUSED` and `enabled: false`, so the cron does not call them.

`source_candidates` exists for notes about possible future sources. Nothing inserts into it automatically, and candidates are never ingested.

## Review

New resources are `AUTO_INGESTED`. Search does not require review. Possible duplicates stay as separate resources with a `duplicate_candidates` row.

## Admin

`apps/admin` listens but returns 404 until `ADMIN_ENABLED=true`, and then requires the MCP bearer token. The maintenance UI is Phase 7.

## Cost

Leave the classifier off. Skip embeddings until a key is configured if you only need keyword search. Sample with `--limit` before `--full`. Request rates are in `config/sources.yaml`.

## Tests before a source change

```bash
npm test
```

Parser fixtures live in `tests/fixtures`. The 25-question search set is Phase 8 and is not in this delivery. `tests/unit/characteristics.test.ts` checks the first five parsers and the per-source cap.
