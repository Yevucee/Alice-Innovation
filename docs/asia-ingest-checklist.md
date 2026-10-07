# Asia ingest checklist

## Queue and verification

1. `npm run asia:rebuild-queue` — reset acquisition seq 1–77 from `scripts/rebuild-asia-acquisition-queue.ts`
2. `npm run asia:verify` — HTTP preflight → `docs/asia-source-acquisition.md`
3. `npx tsx scripts/asia-adapter-dry-run-wave.ts` — discover counts for priority + VC slugs
4. `npx tsx scripts/asia-enable-source.ts <slug> --note "..."` — enable after dry-run

## Enabled sources

All **85** `asia-innovation` queue rows are **`enabled: true`** (generic html-catalogue adapters + bespoke adapters). Re-list:

```bash
npm run asia:list-enabled
```

Bespoke adapters with strong discover: `j-startup`, `wavemaker-partners-portfolio`. Many government/hub rows use **generic catalogue** adapters (`asia-queue-adapters.ts`) — dry-run per slug before expecting full catalogues.

## Production ingest

**Quick wave (2 sources):**

```bash
bash scripts/ingest-production-asia-wave.sh
```

**All enabled Asia sources (long):**

```bash
bash scripts/ingest-production-asia-all-enabled.sh
# remote:
bash scripts/run-with-production-env.sh bash scripts/ingest-production-asia-all-enabled.sh
```

Copy-paste ops prompt for Claude on Railway: **`docs/railway-asia-ingest-prompt.md`**

## SPAs / blocked (adapter backlog)

- SGInnovate, Hub71, HKSTP directory, Insignia, Wavemaker Impact, most government SPAs — need API or custom parsers
- Cyberport, ADB.org, C-CAMP (403) — retry from Railway egress
- Blocked tier seq 87+ — no crawl
