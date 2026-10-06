# Asia ingest checklist

## Queue and verification

1. `npm run asia:rebuild-queue` — reset acquisition seq 1–77 from `scripts/rebuild-asia-acquisition-queue.ts`
2. `npm run asia:verify` — HTTP preflight → `docs/asia-source-acquisition.md`
3. `npx tsx scripts/asia-adapter-dry-run-wave.ts` — discover counts for priority + VC slugs
4. `npx tsx scripts/asia-enable-source.ts <slug> --note "..."` — enable after dry-run

## Enabled sources (wave 1)

| Slug | Discover (dry-run) | Notes |
|------|-------------------|--------|
| `j-startup` | 269+ | `/en/startups/*.html` |
| `wavemaker-partners-portfolio` | many | `wavemaker.vc/portfolio/*` |

## Production ingest

```bash
bash scripts/ingest-production-asia-wave.sh
# or remote:
bash scripts/run-with-production-env.sh bash scripts/ingest-production-asia-wave.sh
```

## SPAs / blocked (adapter backlog)

- SGInnovate, Hub71, HKSTP directory, Insignia, Wavemaker Impact, most government SPAs — need API or custom parsers
- Cyberport, ADB.org, C-CAMP (403) — retry from Railway egress
- Blocked tier seq 87+ — no crawl
