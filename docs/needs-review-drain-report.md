# NEEDS_REVIEW drain report (test database)

Run after migrations on a database with production-like data:

```bash
bash scripts/ensure-local-test-db.sh
DATABASE_URL=postgresql://alice:alice@localhost:5432/alice_test npx tsx scripts/needs-review-source-report.ts
```

On Railway **alice-mcp** shell (production):

```bash
npx tsx scripts/needs-review-source-report.ts
```

The script prints JSON: total NEEDS_REVIEW, `by_reason`, top sources, and up to **10 sample rows each** from `mit-solve`, `atlas-of-the-future`, and `solar-impulse`.

After a cleanup run, compare `quality_review_backlog_runs` in Admin (cleared, SOURCE_LIMITED, newly flagged, net change).
