# NEEDS_REVIEW bulk fix — source follow-up (Oct 2025 dry-run)

Based on prod dry-run `needs_review_bulk_fix_202510` (~3,400 scanned) and code review of ingest parsers.

## mit-solve (~1,229 still flagged)

**Likely causes**

- `truncated_title` from `looksTruncatedTitle` (very short titles, last token ≤3 chars, or `websit` typos).
- `short_description` / thin body when listing-only fetches stored title-only rows.
- `invalid_org_name` / `suspicious_person_name` when team-leader parsing polluted metadata.
- Rows that were ingested before quality drops (`ingest-quality-drop.ts`) still sit in NEEDS_REVIEW from older runs.

**Repair in bulk fix (this PR)**

- `repairBulkFixTitle()` picks the longest of: repaired title, `source_items.title`, `raw_metadata` title fields (`og_title`, etc., with `| MIT Solve` stripped), summary lead, and (for mit-solve) first substantial body sentence.
- **Before → after examples (unit fixtures):**
  - `"Solar"` → `"Solar Water Solutions"` when `source_item_title` / `og_title` hold the full name.
  - `"Wat"` → `"Water filtration pods for rural schools…"` when summary lead is longer.

**When repair is not enough**

- If `canonical_title`, `source_items.title`, and `raw_metadata` all match the truncated value, the full title only exists on the live HTML `h1`. **Option:** run a targeted mit-solve detail refetch job (same as org-recovery detail fetch) and re-parse `h1` + summary, or re-ingest those URLs with `INGEST_ONLY_SOURCES=mit-solve` after clearing stale `source_items` hashes.

## afrilabs (~89 still flagged)

- Many are **thin listing cards** (`listing_only` + `short_description`) or **org/title mismatch** after hub directory ingest.
- `mergeIngestDraftPreservingQuality` prevents downgrade on re-fetch but does not clear existing NEEDS_REVIEW.
- Repair path: title/summary repair + cleared when body is long enough; otherwise remain flagged unless accepted as source-limited (real hub members with thin text) or hidden if junk (site navigation duplicates).

## hundred (~26 still flagged)

- Typically **cohort/boilerplate titles** or **short_description** on portfolio stubs.
- Junk detector catches duplicate title+body within source; remainder need manual review or source-limited after junk pass.

**mit-solve single-word hide rule (narrow):** bulk-fix hides only when `person_name` equals the title (mis-parsed team leader, e.g. “Sabrina”) with body &lt; 120 chars. Ambiguous one-word names (e.g. “Helio”) are **not** hidden — they stay on the normal path and may become `source_limited`.

## j-startup (~15 still flagged)

- Similar to hundred: **thin Japanese/English listing pages** and occasional **truncated_title**.
- Title repair from `source_items.title` helps when the catalogue stored a longer listing title than `canonical_title`.

## Expected dry-run shift (qualitative)

After junk detection + title repair (no apply):

- **hide** increases (navigation/site-name/portal/duplicate junk previously counted as `source_limited`).
- **source_limited** decreases accordingly.
- **cleared** may increase slightly for mit-solve rows where title repair clears `truncated_title`.
- **still_flagged** on mit-solve should drop but remain largest until detail refetch for rows with no longer title in DB.
