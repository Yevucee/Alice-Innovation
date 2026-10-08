# Asia volume step 3 — overlap / dedupe (`j-startup-impact`, `nia-innovation-catalogue`)

## `j-startup-impact` vs `j-startup`

| Field | `j-startup` | `j-startup-impact` |
|-------|-------------|---------------------|
| `collection_url` | `https://www.j-startup.go.jp/en/startups/` | `https://www.j-startup.go.jp/en/` (homepage) |
| Adapter | Bespoke html-catalogue | **Same** listing (`extraListingUrls` → `/en/startups/`) |
| Dry-run discovered | 268 | 269 |
| Production “new” | baseline | **0** (cross-source reuse) |

**Conclusion:** **True duplicate catalogue.** Both adapters discover the same `/en/startups/{slug}.html` URLs. Ingest correctly reuses resources when `j-startup` already has `item_count > 0` (`skipped_duplicate_of` in `pipeline.ts`).

**Recommendation:** Keep `duplicate_of: j-startup` on `j-startup-impact`. No dedupe bug. Optional future work: separate Impact-only METI URL if a distinct static list is published.

## `nia-innovation-catalogue` vs `nia-thailand`

| Field | `nia-thailand` | `nia-innovation-catalogue` |
|-------|----------------|----------------------------|
| Former `collection_url` | NIA homepage | Same homepage (duplicate surface) |
| Step 1 `collection_url` | `…/advance_search/StartUp` | `…/advance_search/Innovation` |
| Adapter | Generic queue | Bespoke `nia-innovation-catalogue` (detail URLs) |
| Dry-run | 0 (generic) | 13 → 0 after nav-URL filter |

**Conclusion:** **Not a true duplicate** once the innovation advance-search listing is used. Prior “0 new” was from ingesting the **same homepage** as `nia-thailand`, not from incorrect URL-level dedupe.

**Change in this PR:** Remove `duplicate_of: nia-thailand` from `nia-innovation-catalogue` so ingest runs when the sibling has items. Distinct URLs (`advance_search/detail/…`) should create new resources once the adapter returns real detail pages (step 1 adapter; may need API/JS follow-up).

## Summary table

| Source | Discovered | Expected new | Risk |
|--------|------------|--------------|------|
| `j-startup-impact` | 269 | **0** (duplicate of `j-startup`) | Low — skip by design |
| `nia-innovation-catalogue` | 0–13 | **TBD** after detail discovery | Med — SPA/search HTML |
