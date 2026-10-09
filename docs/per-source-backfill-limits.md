# Per-source backfill limits (cron `--due`)

Configured in `config/sources.yaml` `limits` — **no** `INGEST_ONLY_SOURCES` / `INGEST_FULL` required.

| Source | Behaviour |
|--------|-----------|
| **mit-solve** | `update_class: DAILY` during backfill (revert to WEEKLY when pending ~0). `max_items_per_run: 1000`, `resume_pending_only: true`, `source_loop_max_minutes: 85` (dedicated; does not eat the global 60m cap). Quality failures `short_description` / `truncated_title` are **dropped** (not NEEDS_REVIEW). |
| **atlas-of-the-future** | `complete_catalogue_per_run: true` — no 500-item first-run default; one due run can ingest the full discovered catalogue (~948). |
| **solar-impulse** | Same as Atlas (~100 URLs in sitemap). |

Cron ingestor uses `npm run start:ingestor -- --due` (see `railway.ingestor.toml`). Sources run when `update_class` schedule says they are due (`last_successful_run`).

`pipeline_stats.dropped_existing` on a run shows how many sitemap refs were skipped as already ingested (mit-solve).
