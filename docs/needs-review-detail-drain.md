# NEEDS_REVIEW detail drain (post-deploy job)

Job key: `needs_review_detail_drain_202510` (migration `026`).

Targets the Oct 2025 production backlog sources: **mit-solve**, **atlas-of-the-future**, **wipo-green**, **solar-impulse**, **injini-african-edtech-map**, **startgate-um6p**, **afrilabs**, **hundred**, **j-startup**.

## Default: dry-run only

The job **does not write** unless you opt in on **`alice-ingestor`**:

```bash
NEEDS_REVIEW_DETAIL_DRAIN_APPLY=true
```

Unset or `false` after a one-off apply.

Optional polite pacing between HTTP fetches (default 350ms):

```bash
NEEDS_REVIEW_DETAIL_DRAIN_DELAY_MS=500
```

## Dry-run summary format

When the job completes a full pass, logs `needs_review_detail_drain_summary` and stores `dry_run_summary` on the post-deploy job **result** (Admin → Post-deploy jobs).

```
NEEDS_REVIEW detail drain | algorithm_version=2 | run_mode=dry_run
totals: repaired=… cleared=… source_limited=… still_flagged=… scanned=… fetch_failed=…
by_source: {"mit-solve":{"repaired":…,"cleared":…,"source_limited":…,"still_flagged":…}, …}
title_samples (up to 20 per source in aggregate):
  [cleared] mit-solve | https://… | "Old title…" → "Full title…"
  [source_limited] injini-african-edtech-map | … | …
```

| Bucket | Meaning |
|--------|---------|
| **repaired** | Detail refetch (or repair pass) materially improved title or body vs stored row |
| **cleared** | Would set `AUTO_INGESTED` (quality gate passes) |
| **source_limited** | Still thin after refetch; would set `SOURCE_LIMITED` with reason codes kept |
| **still_flagged** | Remains `NEEDS_REVIEW` (fixable issues or fetch did not help) |
| **fetch_failed** | Detail fetch skipped or failed — row stays **NEEDS_REVIEW**, no DB write, not counted in `still_flagged` |

Listing-only sources (`injini-african-edtech-map`) skip HTTP detail fetch and may still be classified to **SOURCE_LIMITED**.

## Pass size

Each post-deploy **step** processes **12** rows (`NEEDS_REVIEW_DETAIL_DRAIN_BATCH_SIZE`). A full pass over ~2,967 backlog rows needs **ceil(2967 ÷ 12) = 248** steps (job batches until `complete`).

Embeddings: on apply, re-embed runs with `throwOnConsecutiveFailures: false`. A **402** (or missing API key) leaves IDs in `pending_reembed_ids` for a later pass instead of failing the job.

## Per-source detail pages

| Source | Usable detail? | Notes |
|--------|----------------|-------|
| mit-solve | Yes | `https://solve.mit.edu/solutions/{id}` — h1 / og:title + body |
| atlas-of-the-future | Yes | `/project/{slug}` — h1 / og:title (site name is boilerplate) |
| wipo-green | Yes | WIPO API `…/articles/{id}` (JSON); search payload may be thin |
| solar-impulse | Yes | Solution explorer pages (`ng-state` JSON) |
| startgate-um6p | Yes | `/startups/{slug}` HTML catalogue |
| hundred | Yes | Innovation pages via sitemap |
| j-startup | Yes | Startup detail HTML |
| afrilabs | Partial | WordPress REST **hub** posts; often short hub blurbs only |
| injini-african-edtech-map | **No** | Listing card HTML only; synthetic fragment URLs, no per-startup detail site |

**No real detail page (expect SOURCE_LIMITED after refetch attempt):** `injini-african-edtech-map`.

**Partial / often thin even after refetch:** `afrilabs` (hub listings).

Adapter fixes in this PR: Atlas site-title boilerplate + MIT Solve og:title fallback so **new ingests** pick up full titles.

## Re-ingest behaviour

Rows already marked `SOURCE_LIMITED` stay that way on nightly re-ingest when canonical title/summary/body are unchanged. If the source page content changes, the row can return to `NEEDS_REVIEW`.

## Algorithm version

`DETAIL_DRAIN_ALGORITHM_VERSION` in `packages/database/src/needs-review-detail-drain.ts`. Bumping it re-queues the job after deploy (same pattern as bulk fix).
