# South America ingest — expected counts and failures

Scope: `INGEST_SCOPE=south-america` (Admin **Run South America**). All three catalogues ship **disabled** until preflight samples are approved.

| Source | Adapter | Expected discover (normal) | Notes |
|--------|---------|---------------------------|--------|
| `fapesp-pipe` | `fapesp-pipe` | **3** on hub HTML only (Oct 2026) | Full PIPE Fase 1 set lives behind `/pt/pesquisa/buscador/` (robots **disallows** `/pt/pesquisa/*`) and Zenedge captcha. Detail `/pt/auxilios/<id>/` is allowed. |
| `uc-chile-technologies` | `uc-chile-technologies` | **~60–70** (6 listing pages) | Blocked from cloud egress by Cloudflare challenge (HTTP 403). Parser tested on fixtures. |
| `premios-verdes-500` | `premios-verdes-500` | **0** live (Oct 2026) | List HTML loads but project cards are not present without client-side render; adapter fails loudly with `south_america_zero_discover`. Fixture tests expect ~3 cards per list page sample. South America filter drops Mexico/Central America unless `include_central_america:true` in discovery notes. |

## Quality drops (not NEEDS_REVIEW)

South America adapters throw `IngestQualityDropError` for:

- `short_description` — fewer than two sentences or &lt; ~150 characters on detail
- `listing_excerpt` — UC list excerpt ending in `[…]`
- `truncated_title` / `blocklist_title` / `empty_title`

## Rollout order

1. `fapesp-pipe` (partial catalogue; validates Brazil PIPE parsing)
2. `uc-chile-technologies` (after Cloudflare egress fix)
3. `premios-verdes-500` (after list HTML or allowed API is confirmed)
