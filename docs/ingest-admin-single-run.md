# Admin ingest — one click, one scoped run

## Root cause (Oct 2026 duplicate `scope=all`)

`deploymentInstanceExecutionCreate` starts the ingestor **start command** once per invocation; it does not return a separate “deployment” ingest pass. The duplicate run was a **second ingestor process** that:

1. Did **not** claim the `ingest_requests` row (already `running`/`completed` for the Asia scope).
2. Resolved **`scope=all`** from `INGEST_SCOPE=all` on the service and/or default `parseIngestScope(undefined) → all`.
3. Used **`trigger=manual`** (no `RAILWAY_CRON`, no claimed admin row).

That matches Admin showing a long `scope=all;trigger=manual` run (AfriLabs, Africa sources, etc.) after a successful Asia scoped run.

## Guard (from PR after Oct 2026)

- **Always** attempt to claim `ingest_requests` first (even when `INGEST_SCOPE` is set); claimed scope wins over env.
- If the process would run **`scope=all`** without a claim and **without** `RAILWAY_CRON`, and an **admin-button** request exists in the last **20 minutes**, the ingestor **exits** with log `ingest_skipped` / `unscoped_manual_blocked_recent_admin`.

## Samuel — verify on next Admin → Run Asia

1. Click **Run Asia** once; confirm only **one** ingestor execution in Railway (no manual “Run now” on the service).
2. In logs: `ingest_request_claimed` with `scope=asia`, then `ingest_scope` with the same scope and `request_id` set.
3. **No** second wave of `ingest_scope_selected` with `scope=all` within 20 minutes.
4. Recent ingestion runs should only show Asia-scoped sources (plus any `unmapped` grant bucket if configured), not AfriLabs/Africa festival sources.
