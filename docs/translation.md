# Translation

## Inline English on the site (cards + resource page)

When text looks non-English, users see **Translate to English**. English replaces the same title/summary (and detail sections) **in place**; **Show original** toggles back.

- First click calls `POST /api/resources/[id]/translate` and stores the result in `resource_ui_translations` (migration `020`).
- Later views use the cache (no extra API cost).

### Provider (cheapest first)

Set on the **web** service:

| Priority | Env | Notes |
|----------|-----|--------|
| 1 (cheapest) | `GOOGLE_TRANSLATION_API_KEY` | Cloud Translation API v2 — per-character pricing |
| 2 (fallback) | `ENRICH_API_KEY` or `EMBEDDING_API_KEY` | OpenRouter chat model via `TRANSLATE_MODEL` |

`TRANSLATE_PROVIDER=auto` (default) picks Google if the Google key is set, otherwise OpenRouter.

Optional fallback link: **Google Translate source page ↗** for the full hub HTML.

### Migrate

```bash
npm run migrate   # 020 resource_ui_translations, 021 source_summary_en
```

## At ingest (future)

`INGEST_TRANSLATE_SUMMARY_TO_EN=false` by default. When enabled later, `maybeTranslateSummaryForIngest` can fill `resources.source_summary_en` so English can show without a click.
