# From Africa browse funnel

The homepage **From Africa** row calls `resourcesFromAfrica()` → `searchLibrary` with:

- `continents: ['africa']` — location continent **or** any enabled `africa-innovation` source link
- `qualityBrowse: true` + **`qualityBrowseRelaxed: true`** (after PR) — public-surface filters
- `diverse: false` — up to 8 cards (not one-per-source cap)
- Sort: completeness (image, org, summary richness) then recency

Run locally or on production:

```bash
npm run report:africa-browse-funnel
# or
npm run report:africa-browse-funnel:remote
```

## Strict vs relaxed quality browse

| Rule | Strict (Recently added) | Relaxed (From Africa) |
|------|-------------------------|------------------------|
| NEEDS_REVIEW / ARCHIVED / SOURCE_LIMITED | excluded | excluded |
| ARTICLE | excluded | excluded |
| Summary ≥ 40 chars | yes | yes |
| Body (summary or index text) | ≥ 80 | ≥ 40 |
| ALL CAPS title | excluded | **allowed** |
| Legal-form primary org | excluded | **allowed** |
| Blocklist / pandemic / title=summary | excluded | excluded |

Missing **image** or **organisation** never excluded a row; cards use a type placeholder when `image_url` is empty.

## Why ~1,513 rows were newly flagged in a backlog run

Typical sequence in one post-deploy / cleanup session:

1. **`needs_review_reconcile_202510`** clears many rows to `AUTO_INGESTED` when reconcile accepts thin/source-limited shapes.
2. **`cohort_quality_audit_202510`** runs immediately after and re-scans **all** active `AUTO_INGESTED` resources with the ingest quality gate (without org/person context in the audit query).
3. Anything still matching gate codes (especially **`all_caps_title`**, **`short_description`**, cohort titles) is set back to **`NEEDS_REVIEW`**, which shows up as **newly flagged** in `quality_review_backlog_runs`.

Fixes in this PR:

- **`runAllCapsTitleRepairBatch`** — title-case repair + clear when gate passes; runs at the start of the reconcile post-deploy job.
- **`quality_audit_verified_at`** — reconcile / title repair set this; audit skips verified rows for 30 days.
- Audit **apply** only updates when reason codes actually change (avoids noop re-flags).

## Image backfill and `host_blocked`

Post-deploy **`bulk_image_backfill_202510`** used the ingest **`RunFailureTracker`**, which blocks an entire **host** after HTTP 403/429. A batch of Norrsken URLs could mark `www.norrsken.org` blocked; the rest of the batch was skipped in ~0.3 minutes with **`skipped:host_blocked:…`**.

Image backfill now uses **`ImageBackfillFailureTracker`** (per-URL only) and advances to the next source when an entire batch is skipped.
