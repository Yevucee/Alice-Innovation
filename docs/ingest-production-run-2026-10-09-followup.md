# Production ingest follow-up (manual run 2026-10-09, post-#86)

Admin snapshot (user-provided, not local DB):

| Metric | Value |
|--------|------:|
| Total resources | 37,047 |
| MIT Solve ingested / pending | 25,025 / ~0 |
| Atlas | 947 / 948 |
| Solar Impulse ingested / discovered | 2,031 / 2,127 (~96 gap) |
| Last full run new | ~360 (Third Derivative 232 + 5 failed, Mulago 62, Earthshot 10) |
| NEEDS_REVIEW | 3,207 → 3,291 (+84) |
| Hub71 startup directory | discovers 316, run **FAILED** `Invalid URL` |

---

## 1) Hub71 — root cause (still failing after #86)

#86 fixed **discover** `ref.url` (stable `/startups/{slug}`) and `resolveHub71PublicUrl` for listing JSON websites. Production still discovers **316** then fails at source level with **`Invalid URL`** before items complete.

**Root cause:** `loadSourceItemListingStateMap` (called at the start of processing) runs `canonicaliseUrl(row.canonical_url)` for **every active `source_items` row**. Rows from the **pre-#86** adapter used malformed `website` values as `canonical_url` (e.g. `": https://…"`, empty, or relative junk). `canonicaliseUrl` throws → uncaught → whole source `FAILED` with message `Invalid URL`. Discover succeeds (316 logged); failure happens when building the listing-state map or catalogue hash, not during parse.

**Fix (this PR):**

- `tryCanonicaliseUrl` in `@alice/shared` (null on bad input).
- Listing-state map skips bad stored URLs (still keyed by `external_id`).
- `listingContentHash` / pipeline catalogue use safe canonicalisation.
- `buildDraft` drops invalid `imageUrl` only (malformed logo/meta), never the page URL.

**Dry-run (listing JSON, egress):**

| Metric | Count |
|--------|------:|
| Discovered | 316 |
| Quality gate pass (would insert AUTO_INGESTED) | **211** |
| Quality gate fail (mostly `short_description`, some `truncated_title`) | 105 |

`npx tsx scripts/hub71-dry-run.ts`

---

## 2) Solar Impulse ~96 gap

| | |
|--|--|
| Discovered (sitemap, EN paths) | 2,127 unique URLs |
| Admin ingested | 2,031 |
| Gap | **96** |

Solar does **not** hard-drop at the quality gate (unlike MIT Solve / YC). `NEEDS_REVIEW` rows still upsert and count as ingested. The gap is therefore **not** explained by quality flags or `IngestQualityDropError`.

**Expected reasons (ordered by likelihood):**

| Reason | Notes |
|--------|--------|
| **HTTP / rate-limit failures** | `impulse-foundation.com` returns **429** under concurrent fetch (observed during gap audit). Failed items increment `items_failed` without a resource. |
| **Parse failures** | Missing `ng-state` JSON on HTML → throw before upsert. |
| **Inactive / disappearance** | `confirmDisappearances` after two misses; URL left sitemap or fetch permanently fails. |
| **Cross-source canonical reuse** | Same canonical URL already owned by another source → item may show as unchanged/reuse (usually still counts if `source_items` exists). |

Full per-URL breakdown needs production `ingestion_errors` / `source_items` without `resource_id` (not available in agent). Recommended Admin/SQL slice:

```sql
-- source_items for solar-impulse without resource_id or inactive
SELECT failure_reason, COUNT(*) FROM ingestion_errors
WHERE source_id = (SELECT id FROM sources WHERE slug = 'solar-impulse')
  AND created_at > '2026-10-08' GROUP BY 1;
```

**No gate loosening** in this PR. Mitigation for 429: respect `requests_per_minute` (avoid parallel gap scripts against production host).

---

## 3) Third Derivative — 5 failed (last run)

Discover was **317** URLs; **5** production failures match junk or dead portfolio paths:

| URL | Cause |
|-----|--------|
| `/portfolio/rss`, `/portfolio/tag`, `/portfolio/c` | Nav/feed false positives from `htmlUrlPattern` |
| `/portfolio/calwave`, `/portfolio/strawcture-eco-pvt` | **HTTP 404** (removed companies / truncated slug) |

**Fix:** Tighter `pathPattern` (slug ≥3 chars), `excludePathPattern` for `rss`/`tag`, tighter regex in `htmlUrlPattern`. Discover **311** after fix (−6 junk; 404 slugs still fail per-item, not whole source).

---

## 4) MIT Solve schedule

`update_class` reverted to **`WEEKLY`** with **`source_loop_max_minutes: 85`** and **`max_items_per_run: 1000`** unchanged (pending ~0 in Admin).

---

## 5) NEEDS_REVIEW +84 (3,207 → 3,291)

Largest movers (user-reported):

| Signal | Δ | Likely driver |
|--------|--:|----------------|
| WIPO GREEN | 110 → 160 (+50) | Weekly API ingest adds technology records; many get `invalid_org_name` / thin company field |
| `invalid_org_name` | 236 → 290 (+54) | `sanitiseOrganisationName` rejects placeholder/junk `organisationName` (WIPO `company`, directory titles, colon-split titles) |

**Other +84** likely spread across `short_description`, `truncated_title`, and programme noise on newly touched sources (Third Derivative, Mulago, Earthshot) — exact reason histogram needs `quality_review_breakdown` on production.

**Obvious fix (low risk):** For **WIPO GREEN**, when `company` is empty, set `organisationName: null` and rely on title (already partially done); extend to strip legal suffix-only org strings. **Do not** auto-accept junk org names — keeps browse quality.

---

## 6) High-volume candidates

See **`docs/open-volume-candidate-report-2026-10-09.md`** (live probes from Cloud Agent egress).
