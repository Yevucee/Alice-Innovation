# Asia ingest: why `discovered` ≫ `items_new`

Admin **items_new** = `ingestion_runs.items_new` = **new resources created** (`counts.created`), not “new source_items” or “updated”.

## Common reasons (not bugs)

| Signal | Meaning |
|--------|---------|
| `pipeline_stats.cross_source_reuse` | Same `canonical_url` already ingested under another slug (e.g. `j-startup-impact` after `j-startup`). Counts as **updated**, not **new**. |
| `pipeline_stats.skipped_duplicate_of` | Source has `duplicate_of` and sibling already has items — run skipped intentionally. |
| `pipeline_stats.dropped_limit` | `INGEST_FIRST_RUN_ITEM_LIMIT` (default 80) truncated the batch on first successful run. |
| `pipeline_stats.detail_skipped` | Listing unchanged; detail fetch skipped (steady-state). |
| `items_unchanged` | Item already on this source with same content hash. |
| `items_failed` | Parse error, `catalogue_junk`, HTTP error, quality detail fetch failure. |

## Examples from production-style runs

| Source | discovered | new | Typical explanation |
|--------|------------|-----|---------------------|
| `j-startup-impact` | 269 | 0 | `duplicate_of: j-startup` — URLs already linked to resources from `j-startup` → cross-source reuse / updated only. |
| `birac-technology-portal` | 53 | 0 | First-run **80 cap** may have processed hub/nav pages; many **unchanged** or **failed** parse; few true company pages. |
| `atal-innovation-mission` | 58 | 1 | Government hub links; most pages are not portfolio detail URLs. |
| `hkstp-company-directory` | 63 | 24 | Mix of **new**, **cross_source_reuse**, **failed** (nav URLs like `/en/discover`), and **limit** on first run. |
| `nia-innovation-catalogue` | 49 | 0 | Same homepage as `nia-thailand`; duplicate catalogue + cross-source reuse. |

## Report after migration `023`

```bash
npm run migrate
npx tsx scripts/report-ingest-source-losses.ts --category=asia-innovation
```
