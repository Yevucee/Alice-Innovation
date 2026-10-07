# First-run ingest limits

- **`INGEST_FIRST_RUN_ITEM_LIMIT`** (default **500** after step b): caps items processed on a source’s **first successful ingest** when no `--limit` is passed.
- **`limits.first_run_item_limit`** in `config/sources.yaml`: per-source override (e.g. `j-startup: 300` for ~269 startups).
- After `sources.last_successful_run` is set, full catalogue runs use **no cap** (unless `--limit`).

Bootstrap Asia runs without `--full` still use the cap; use `--full` for complete catalogues once adapters are verified.
