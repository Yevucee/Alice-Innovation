# Production follow-up (Claude findings, Oct 2025)

## 1. Translate on `/search?continent=asia` cards

**Why German PaySpot bios had no button**

- Inline translation is implemented on **both** search cards and resource detail pages when `inlineTranslationConfigured()` is true (Google key or `ENRICH_API_KEY` / `EMBEDDING_API_KEY` / `TRANSLATE_API_KEY` on the **web** service).
- Detection used `likelyNeedsTranslation`, which only treated non-`en` **language metadata** and **CJK/Arabic/Thai/Devanagari** script as needing translation. **German Latin text** with `language = en` or null did not qualify.
- Search card hydration did not include `resources.language`, so cards could not use DB language even when set.

**Fix (this PR):** German/Latin heuristics (umlauts + function words), and `language` on `CompactResource` passed into card summary translate UI.

**Production checks (run on DB after deploy + migrate):**

```sql
SELECT version, applied_at FROM schema_migrations WHERE version IN ('020', '021') ORDER BY version;
SELECT count(*) AS ui_translation_rows FROM resource_ui_translations;
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'resources' AND column_name = 'source_summary_en';
```

**Web env:** `GOOGLE_TRANSLATION_API_KEY` or OpenRouter fallback via `EMBEDDING_API_KEY` (see `apps/web/src/lib/translate-provider.ts`).

## 2. Asia catalogue quality

- **J-Startup:** `cleanJStartupSummary` in adapter parse + post-deploy job `asia_catalogue_quality_202510` scrubs existing rows and clears single-tag **Sensors** (re-enrich on next ingest for better sectors).
- **Adapters:** `catalogue-junk` heuristics in `html-catalogue` parse; generic Asia queue adapters exclude author/event/news paths.
- **HKUST / PaySpot:** batch quarantine to `NEEDS_REVIEW` with `catalogue_junk_quarantine` (slugs `hkust-*`, `%payspot%`, author+casino URLs).

**Keep disabled until adapters are verified** (from `docs/asia-adapter-ready-slugs.json` dry-run): all Asia slugs except **`j-startup`**, **`j-startup-impact`**, and **`wavemaker-partners-portfolio`** (`discovered > 0`). See `docs/asia-ingest-expected-failures.md` for HTTP 403/404 list.

## 3. `bulk_image_backfill_202510` / `skipped:url_failed`

**Root cause:** Listing-card image steps called `adapter.discover()` with the same URL failure tracker as per-item fetches. After a listing URL failed once, every later step threw `skipped:url_failed` on discover **before** advancing `listing_source_index`, producing thousands of no-op steps, empty `totals`, and `skip:url_failed` in Admin.

**Fix:** Separate discover fetches (no tracker skip) + catch discover errors; advance page index when a batch is all skipped **or** failed.

## 4. Resume after deploy interrupt

- Ingest: existing `markInterruptedIngestionRuns`.
- Post-deploy: **`resetStalePostDeployJobs`** sets `in_progress` → `pending` when `updated_at` predates the new process start (runs on ingestor boot).
