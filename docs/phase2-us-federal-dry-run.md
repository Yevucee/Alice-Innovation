# Phase 2 US federal open-data — dry-run (2026-10-07)

| Source | enabled | discovered @limit=500 | Sample titles | Risk |
|--------|---------|----------------------|---------------|------|
| `nih-sbir-sttr-portfolio` | true | **500** | SBIR/STTR project titles from RePORTER | Very large catalogue; use batched ingest |
| `nih-reporter-innovation-grants` | true | **500** | Innovation keyword grants 2020–2025 | Broader than SBIR-only |
| `nsf-awards-catalogue` | true | **500** | NSF award titles + awardee | Millions of awards total; adapter caps pages |
| `usaspending-sbir-awards` | true | **500** | SBIR contract/grant descriptions | Keyword noise possible |
| `usaspending-sttr-awards` | true | **500** | STTR award lines | Smaller than SBIR |

Requires **phase 2 EU PR** merged first (shared open-data adapter code).
