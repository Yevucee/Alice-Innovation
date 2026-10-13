# South America ingest — expected counts and failures

Scope: `INGEST_SCOPE=south-america` (Admin **Run South America**). Seven catalogues are **enabled**; two are expected to fail from cloud egress until fixed.

| Source | Adapter | Expected discover (normal) | Notes |
|--------|---------|---------------------------|--------|
| `fapesp-pipe` | `fapesp-pipe` | **3** on hub HTML only (Oct 2026) | Full PIPE Fase 1 set lives behind `/pt/pesquisa/buscador/` (robots **disallows** `/pt/pesquisa/*`) and Zenedge captcha. Detail `/pt/auxilios/<id>/` is allowed. |
| `gridx-portfolio` | `gridx-portfolio` | **~23–71** SA-labelled cards | Full portfolio ~84; South America country filter applies. Listing-only blurbs enriched to meet description gate. |
| `unc-oferta-tecnologica` | `unc-oferta-tecnologica` | **~30** Drupal nodes | Three listing pages; detail `/node/{id}`. |
| `usp-vitrine-portfolio` | `usp-vitrine-portfolio` | **~32** slugs | Detail via `/portfolio/{slug}/_payload.json` (Nuxt dehydrated JSON). |
| `cuech-red-proyectos` | `cuech-red-proyectos` | **~9** modals | Legacy `/proyectos/` page; listing-only ingest. |
| `uc-chile-technologies` | `uc-chile-technologies` | **~60–70** (6 listing pages) | **Expected fail:** Cloudflare challenge (HTTP 403) from cloud egress. Parser tested on fixtures. |
| `premios-verdes-500` | `premios-verdes-500` | **0** live (Oct 2026) | **Expected fail:** project cards not in server HTML (client render). Fixture tests use saved list HTML. South America filter drops Mexico/Central America unless `include_central_america:true` in discovery notes. |

Scoped runs mark the whole scope **failed** if any source fails, even when five sources succeed — expect Admin summary to list `uc-chile-technologies` and `premios-verdes-500` until egress/SSR is fixed.

## Quality drops (not NEEDS_REVIEW)

South America adapters throw `IngestQualityDropError` for:

- `short_description` — fewer than two sentences or &lt; ~150 characters on detail
- `listing_excerpt` — UC list excerpt ending in `[…]`
- `truncated_title` / `blocklist_title` / `empty_title`

## Rollout order

1. `fapesp-pipe`, `gridx-portfolio`, `unc-oferta-tecnologica`, `usp-vitrine-portfolio`, `cuech-red-proyectos` (plain HTTP)
2. `uc-chile-technologies` (after Cloudflare egress fix)
3. `premios-verdes-500` (after list HTML or allowed API is confirmed)

See `docs/south-america-candidates-rejected.md` for wave-2 holds (Sebrae, IDB, UFMG, etc.).
