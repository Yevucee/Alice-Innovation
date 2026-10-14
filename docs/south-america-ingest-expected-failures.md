# South America ingest — expected counts and failures

Scope: `INGEST_SCOPE=south-america` (Admin **Run South America**). **Five** catalogues are **enabled** (Oct 2026). UC Chile and Premios Verdes are **disabled** so they no longer fail nightly runs.

| Source | Adapter | Expected discover (normal) | Notes |
|--------|---------|---------------------------|--------|
| `fapesp-pipe` | `fapesp-pipe` | **3** on hub HTML only | Full PIPE set behind robots-disallowed buscador + captcha. |
| `gridx-portfolio` | `gridx-portfolio` | **~23–71** SA-labelled cards | Checkpoint may skip previously ingested URLs on non-`--full` runs; use `--full` for a complete SA pass. |
| `unc-oferta-tecnologica` | `unc-oferta-tecnologica` | **~30** Drupal nodes | Uses **IPv4-only** HTTP (host AAAA is unreachable from cloud egress). |
| `usp-vitrine-portfolio` | `usp-vitrine-portfolio` | **~32** slugs | Detail via `/portfolio/{slug}/_payload.json`. |
| `cuech-red-proyectos` | `cuech-red-proyectos` | **~9** modals | Legacy `/proyectos/` listing-only. |
| `uc-chile-technologies` | — | — | **Disabled** — Cloudflare **403**, 14 Oct 2026. |
| `premios-verdes-500` | — | — | **Disabled** — no SSR project cards in HTML, 14 Oct 2026. |

## Quality drops (not NEEDS_REVIEW)

South America adapters throw `IngestQualityDropError` for short descriptions, listing excerpts, and bad titles — see adapter code.

## Production audit SQL

Read-only queries for `ingestion_runs`, `ingest_requests`, and failed-run breakdown: `scripts/south-america-production-audit.sql`.
