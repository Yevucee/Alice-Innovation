# Production ingest follow-up (2026-10-09 manual run)

## 1) MIT Solve / Atlas / Solar / StartGate — 0 new items

**Root cause (code + Railway wiring):**

1. **Due-only on manual “Run now”** — `railway.ingestor.toml` start command is `npm run start:ingestor -- --due`. Manual one-offs use the same command **without** `RAILWAY_CRON=1`, but the ingestor treated `--due` as “due schedule only” for every run. Sources such as `mit-solve` (WEEKLY), `atlas-of-the-future` (MONTHLY), and `solar-impulse` (WEEKLY) that had `last_successful_run` within their window logged `source_not_due` and **never started an `ingestion_runs` row** — so Admin showed 0 new with no explanation.

2. **Post-deploy before ingest on manual runs** — `shouldRunPostDeployBeforeIngest` returned true for every manual trigger, so ~1h45m of the 1h46m session was **post-deploy cleanup** (default budgets), leaving ~2–3 minutes for the source loop. That amplified the “nothing ran” effect but was not the sole reason high-priority catalogues were skipped (due-only was).

**Not the cause:** `INGEST_SOURCE_LOOP_MAX_MINUTES` (60) applies only inside `runIngestion`, not to post-deploy. `resume_pending_only` on `mit-solve` would yield `new=0` only **after** the source actually runs with an empty pending queue.

**Fix in PR:**

- Manual Run now: `--due` + **no** `RAILWAY_CRON` → ingest **all enabled** sources (cron unchanged).
- Manual default: post-deploy **after** ingest; `POST_DEPLOY_BEFORE_INGEST=true` to restore pre-ingest cleanup.
- `source_skipped` log + `ingestion_runs` row `status=SKIPPED`, `error_summary=skipped:not_due`.
- Successful runs set `error_summary` to `ran:discovered=…;pending=…;new=…;…` (Admin **Outcome** column).

## 2) Hub71 — Invalid URL

**Root cause:** Discover used `row.website` as `ref.url`. Several JSON rows have `website: null` or malformed values (e.g. `": https://…"`). `canonicaliseUrl(ref.url)` in the pipeline threw **Invalid URL** and failed the whole source.

**Fix:** Discover always uses stable `https://www.hub71.com/startups/{slug}`; websites normalized via `resolveHub71PublicUrl`. Dry-run: **316** discovered; **27/50** pass quality gate on listing JSON (detail fetch not required for those).

## 3) Disabled sources (persistent failures)

| Slug | Action | Reason |
|------|--------|--------|
| adb-ventures-portfolio | `enabled: false` | collection URL HTTP 404 |
| appworks-accelerator | `enabled: false` | `/portfolio` HTTP 404 |
| ccamp | `enabled: false` | HTTP 403 |
| china-innovation-entrepreneurship-competition | `enabled: false` | unreachable from ingest egress |
| climate-impact-innovations-challenge | `enabled: false` | unreachable |
| cyberport | `enabled: false` | robots.txt HTTP 403 |
| cyberport-incubation-programme | `enabled: false` | same host robots wall |
| findit-taiwan | `enabled: false` | unreachable |
| hkstp-elite-portfolio | `enabled: false` | `/en/elite` HTTP 404 |
| iit-delhi-innovation | `enabled: false` | incubation host unreachable |
| iit-kharagpur-innovation | `enabled: false` | department URL unreachable |

## 4) HKSTP nightly

`hkstp-company-directory` does **not** require `INGEST_FULL`. Without `--full`, checkpoint resume is off; **detail skip** (`shouldSkipDetailFetch` + listing hash) avoids refetching ~1,289 stored rows. Expect **~0–10 new/night** unless sitemap adds companies or listing hashes change.

## MIT Solve backfill (added to #86)

- `update_class: DAILY` with YAML comment + coverage note to revert to WEEKLY when pending ~0.
- `source_loop_max_minutes: 85` — dedicated cap; **does not** consume `INGEST_SOURCE_LOOP_MAX_MINUTES` (default 60) for other sources.
- **Time math:** 1,000 items × 3s min interval (20 rpm) ≈ **50 min** fetch floor; observed **55–75 min** with parse/enrich skip → **85 min** cap fits 1k; global **60 min** alone would truncate around **~800–900** items and block later sources if `mit-solve` ran under the shared cap.
- Admin: **MIT Solve backfill progress** + Atlas/Solar catalogue lines (production DB).

## Expected 04:00 UTC cron (after deploy)

- **Due-only** applies (`RAILWAY_CRON=1`).
- Sources **due** that day (DAILY/WEEKLY/MONTHLY elapsed) run; others get `SKIPPED` + `skipped:not_due` in Admin.
- Rough new items (order of magnitude): `mit-solve` up to **1,000** pending URLs if due; `startgate-um6p` / Africa backlog if WEEKLY due; Hub71 **~300** first successful run after fix; HKSTP **~0**; CORDIS up to **500**/run cap if due.
