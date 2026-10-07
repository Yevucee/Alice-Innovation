# Phase 2 EU open-data adapters — dry-run (Cloud Agent, 2026-10-07)

Command: `npm run adapter:sample-dry-run -- --source=<id> --limit=5` unless noted.

| Source | enabled | discovered @limit=500 | Sample titles | Risk |
|--------|---------|----------------------|---------------|------|
| `cordis-eu-research-projects` | true | **500** (cap per discover pass; catalogue 100k+) | Smart grid…; Spanish SME virtual fitting room… | Multilingual duplicate articles deduped by project id |
| `cordis-eu-research-results` | true | (same API family) | Result articles | Same |
| `cordis-horizon-europe-projects` | true | (programme filter) | Horizon Europe subset | Filter overlap with main catalogue |
| `cordis-fp7-projects` | true | (programme filter) | Legacy FP7 | Older projects |
| `cordis-horizon-2020-projects` | true | (programme filter) | H2020 | Large backlog |
| `cordis-eic-accelerator-projects` | true | (programme filter) | EIC Accelerator | Startup-heavy |
| `eu-innovation-radar` | **false** | **0** (HTTP **403** from this egress) | — | Enable after dry-run passes on Railway ingestor; adapter implemented |

`eu-innovation-radar` remains registered but disabled until ingestor egress can reach the API.
