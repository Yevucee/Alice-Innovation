# Asia ingest — sources likely to fail or return zero items

Use this before a full Asia programme ingest. HTTP preflight lives in `docs/asia-source-acquisition.md`; adapter discover sweep in `docs/asia-adapter-ready-slugs.json`.

## Adapter discover = 0 (generic HTML catalogue not wired yet)

As of the latest dry-run sweep, only these enabled slugs reported **`discovered > 0`** without extra adapter work:

- `j-startup`
- `j-startup-impact`
- `wavemaker-partners-portfolio`

Expect **zero discover** on first ingest for most other enabled `asia-innovation` slugs until their listing HTML is verified and the shared catalogue adapter matches the page structure.

## HTTP preflight failures (403, 404, timeout)

From `docs/asia-source-acquisition.md` — collection URLs that failed from Railway-style egress:

| Slug | Issue |
|------|--------|
| `startup-india-showcase` | HTTP 404 |
| `national-startup-awards-india` | HTTP 404 |
| `switch-slingshot` | fetch error |
| `ntuitive` | HTTP 404 |
| `findit-taiwan` | fetch error |
| `startup-terrace-taiwan` | fetch error |
| `seoul-startup-plus` | fetch error |
| `seoul-bio-hub` | fetch error |
| `hkstp-elite-portfolio` | HTTP 404 |
| `cyberport` | HTTP 403 |
| `cyberport-incubation-programme` | HTTP 403 |
| `mystartup-malaysia` | fetch error |
| `mystartup-startup-directory` | fetch error |
| `climate-impact-innovations-challenge` | fetch error |
| `startup-sri-lanka` | HTTP 502 |
| `astana-hub-startup-programmes` | HTTP 404 |

## SPAs / login walls (registered but disabled)

These remain **`status: BLOCKED`** in `config/sources.yaml` and should not be ingested:

- `e27`, `techinasia`, `crunchbase`, `tracxn`, `dealroom`, `pitchbook`, `cbinsights`

## Norrsken / host-blocked image backfill (Africa, not Asia)

Post-deploy image backfill no longer uses ingest **`RunFailureTracker`** host blocking (see `bulk_image_backfill_202510` counters in Admin). Africa Norrsken listing image steps still need per-URL skips, not whole-host blocks.

## Recommended first wave

1. `npm run asia:verify` on Railway MCP.
2. Ingest with bootstrap only: `ASIA_INGEST_FULL=0 bash scripts/ingest-production-asia-all-enabled.sh`
3. Watch **Admin → Asia ingest** for zero-discover and failed sources before enabling `--full`.

## Ingest expectations (all Asia sources stay `enabled: true` in config)

Dry-run snapshot: `docs/asia-adapter-ready-slugs.json`. Full failure matrix: `docs/asia-source-failure-matrix.md`.

Most slugs still return **discover 0** until listing paths or bespoke adapters land; ingest is safe (quality gate + `NEEDS_REVIEW`) but noisy. Prefer `adapter:sample-dry-run` per slug before full `--full` passes.

**Quality note:** `hkust-entrepreneurship-center` and generic catalogue slugs may ingest event/nav junk until adapters and `asia_catalogue_quality_202510` quarantine run; PaySpot-style author bios match `%payspot%` quarantine rules.
