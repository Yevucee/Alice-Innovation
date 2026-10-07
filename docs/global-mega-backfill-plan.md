# Mega backfill plan — MIT Solve, Startgate, Solar Impulse, Atlas

Run on **ingestor** service after migrations **023** applied and web/ingestor deploy from `main` (includes #69–#72).

## Environment (Railway ingestor)

```env
INGEST_FIRST_RUN_ITEM_LIMIT=500
INGESTION_USER_AGENT=AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)
INGESTION_REQUEST_TIMEOUT_MS=45000
```

Per-source overrides already in YAML: `j-startup` 300, `wavemaker-partners-portfolio` 200.

## Order (single ingest lock)

1. **Startgate** — unblocks Africa queue scripts that wait on ingestor idle.
2. **Atlas of the Future**
3. **Solar Impulse**
4. **MIT Solve** — batched only (catalogue ~25k URLs).

## Commands (production shell on ingestor, repo root)

```bash
# 1) Startgate (~1.9k listings; use --full after first success)
npm run ingest -- --source=startgate-um6p --full

# 2) Atlas (~950 projects)
npm run ingest -- --source=atlas-of-the-future --full

# 3) Solar Impulse (~2.1k sitemap URLs)
npm run ingest -- --source=solar-impulse --full

# 4) MIT Solve — batches of 500 until checkpoint covers catalogue
for batch in 1 2 3 4 5 6 7 8 9 10; do
  npm run ingest -- --source=mit-solve --limit=500
done
# Then one --full when comfortable with quality/enrich load
# npm run ingest -- --source=mit-solve --full
```

## Suggested limits / expectations

| Source | Mode | Expected new resources (order of mag.) | Notes |
|--------|------|----------------------------------------|--------|
| `startgate-um6p` | `--full` | 1,500–2,000 | Junk fix #72; enrich titles |
| `atlas-of-the-future` | `--full` | 700–950 | Title cleanup job may help |
| `solar-impulse` | `--full` | 1,500–2,100 | Long URLs; partial metadata OK |
| `mit-solve` | `--limit=500` × N | 3,000–8,000 over 10 batches | Generic titles; run enrich after |

## Post-run

```bash
npm run migrate   # if not already on 023+
npx tsx scripts/report-ingest-source-losses.ts --category=asia-innovation
npm run ops:coverage:remote
```

## Asia policy

All **85** Asia sources remain `enabled: true`; use admin run stats + loss report instead of disabling in YAML.
