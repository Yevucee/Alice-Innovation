# Translation

## In the app (free, all devices)

When title/summary look non-English, the UI shows **Translate to English** links that open **Google Translate** in a new tab:

- **Translate to English** — title + summary text.
- **Translate source page** — the original hub URL (when we have it).

Works on phone and desktop browsers (Safari, Chrome, etc.) without API keys or cost to Alice.

## At ingest (future, optional)

Migration `021_resource_summary_en` adds `resources.source_summary_en`.

- Hook: `maybeTranslateSummaryForIngest` in `apps/ingestor/src/ingest-summary-translate.ts` (called from the item pipeline).
- Default: **off** (`INGEST_TRANSLATE_SUMMARY_TO_EN=false`).
- When enabled later, wire a cheap provider (e.g. Google Cloud Translation API) to fill `source_summary_en` for non-English items only — then the web app can show English inline without opening Google.

Do **not** bulk-translate the whole catalogue; only new/updated non-English rows when the flag is on.
