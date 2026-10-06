# Asia geography in search and filters

Mirror of `docs/africa-geography.md` for the Asia acquisition programme.

## Sources

- Master queue: `config/asia-acquisition-queue.json` (seq 1–77 acquisition, 78–86 university, 87–93 blocked).
- Regenerate acquisition rows from spec: `npm run asia:rebuild-queue`
- HTTP preflight report: `npm run asia:verify` → `docs/asia-source-acquisition.md`
- Register paused sources in `config/sources.yaml`: `npm run asia:register-sources`

## Category

New catalogue sources use **`asia-innovation`**. Ingest defaults tag continent **Asia** when pages omit country (`applyGeographyDefaults` in the ingestor). Per-hub defaults live in `ASIA_SOURCE_GEO_DEFAULTS` (`packages/taxonomy/src/asia.ts`).

## Search

Continent filter **`asia`** matches location continent **or** any enabled **`asia-innovation`** source link (same pattern as Africa in `search-sql.ts`).

## Ops

After adapters are verified and enabled:

1. Run ingest with limits per source (`npm run adapter:sample-dry-run -- --source=<id>` first).
2. Run quality audit / NEEDS_REVIEW reconcile as for Africa cohorts.
3. Add `resourcesFromAsia()` homepage row when relaxed quality browse count is healthy (see `docs/africa-browse-funnel.md`).

## Blocked / manual-only (seq 87+)

Do not crawl e27, Tech in Asia, Crunchbase, Tracxn, Dealroom, PitchBook, or CB Insights without explicit terms/licensing review. Entries are registered as **BLOCKED** in `sources.yaml`.
