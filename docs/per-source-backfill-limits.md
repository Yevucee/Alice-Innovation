# Per-source backfill limits (cron `--due`)

Configured in `config/sources.yaml` `limits` — **no** `INGEST_ONLY_SOURCES` / `INGEST_FULL` required.

| Source | Behaviour |
|--------|-----------|
| **mit-solve** | `max_items_per_run: 1000`, `first_run_item_limit: 1000`, `resume_pending_only: true` — each due run ingests up to 1k **not-yet-stored** solution URLs. Quality failures `short_description` / `truncated_title` are **dropped** (not NEEDS_REVIEW). |
| **atlas-of-the-future** | `complete_catalogue_per_run: true` — no 500-item first-run default; one due run can ingest the full discovered catalogue (~948). |
| **solar-impulse** | Same as Atlas (~100 URLs in sitemap). |

Cron ingestor uses `npm run start:ingestor -- --due` (see `railway.ingestor.toml`). Sources run when `update_class` schedule says they are due (`last_successful_run`).

`pipeline_stats.dropped_existing` on a run shows how many sitemap refs were skipped as already ingested (mit-solve).
