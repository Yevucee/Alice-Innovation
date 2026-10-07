# Railway “Run now” — targeted full ingest (no shell)

Set on **alice-ingestor** → **Variables**, then **Run now** (one run per row). Clear variables after each run or reuse the next row.

| Step | Variables | Purpose |
|------|-----------|---------|
| 1 | `INGEST_ONLY_SOURCES=startgate-um6p` + `INGEST_FULL=true` | Full Startgate backfill |
| 2 | `INGEST_ONLY_SOURCES=atlas-of-the-future` + `INGEST_FULL=true` | Full Atlas |
| 3 | `INGEST_ONLY_SOURCES=solar-impulse` + `INGEST_FULL=true` | Full Solar Impulse |
| 4a–4j | `INGEST_ONLY_SOURCES=mit-solve` + `INGEST_ITEM_LIMIT=500` (leave `INGEST_FULL` unset) | Run now **10 times**; review admin quality after batch 1 before continuing |

**Defaults to keep set:**

```env
INGEST_FIRST_RUN_ITEM_LIMIT=500
INGESTION_REQUEST_TIMEOUT_MS=45000
```

`INGEST_ONLY_SOURCES` skips the due schedule and ingests only listed slugs (comma-separated). `INGEST_FULL=true` forces catalogue refresh even after a prior successful run.
