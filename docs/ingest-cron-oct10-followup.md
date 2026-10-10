# Production ingest follow-up — overnight cron 2026-10-10

Admin snapshot (user-provided): **37,047** resources unchanged. **04:00 UTC cron** spent the full **60-minute** global source budget on **`solar-impulse`** (1,280/2,127 attempted, **1,279 failed**, 0 new). **`hub71-startup-directory`** still **FAILED** `Invalid URL` (disc 316, new 0) after #87.

---

## 1) Solar Impulse paused

`solar-impulse` → `enabled: false` with cron comment. Data retained.

**Failure cause (egress):** `impulse-foundation.com` returns **HTTP 429** under ingest concurrency; item-level failures, not quality gate. Circuit breaker (below) would have stopped after 25 consecutive failures.

---

## 2) Per-source failure circuit breaker

New logic in `apps/ingestor/src/pipeline.ts` + `source-failure-circuit.ts`:

- Stop after **25 consecutive** item failures, **or**
- After **50** items, if **failed > 50%**
- Outcome column: `stopped_reason=circuit:...` appended to `error_summary`
- Processing continues with the **next source** in the cron pass

---

## 3) Hub71 `Invalid URL` — root cause & stack trace

### Reproduced stack (pre-#87 / legacy DB rows)

Production rows from the **pre-#87** adapter stored malformed `website` values as `source_items.canonical_url` (e.g. `": https://…"`). Building the listing-state map used **`canonicaliseUrl(row.canonical_url)`** per row → **uncaught `TypeError: Invalid URL`** → whole source **FAILED** (disc 316 logged, 0 items processed).

```text
TypeError: Invalid URL
    at new URL (node:internal/url:818:25)
    at canonicaliseUrl (packages/shared/src/url.ts:38:15)
    at legacyLoadListingStateMapKeys (scripts/hub71-repro-invalid-url-stack.ts:17:13)
```

Run: `npx tsx scripts/hub71-repro-invalid-url-stack.ts`

### Why production may still show FAILED after #87

1. **#87 fix** (`tryCanonicaliseUrl` in `loadSourceItemListingStateMap`) should skip bad keys — verify ingestor image includes commit `46e95c8+`.
2. **Legacy rows** still need repair on touch: this PR updates `touchSourceItemWithoutDetailFetch` to **rewrite `canonical_url`** when skipping detail fetch.
3. **Logging:** `ingest_listing_state_malformed_canonical_url` + `source_failed.ingest_stage` on outer catch.

Listing JSON today: **316** discover, **0** website/buildDraft failures (`scripts/hub71-website-scan.ts`).

---

## 4) Asia / Africa — keep / fix / disable

Live probe: `scripts/probe-asia-slug-list.ts` → `/opt/cursor/artifacts/asia-slug-probe.json`

### Keep enabled (working volume)

| Source | Discovered (probe) | Notes |
|--------|-------------------:|--------|
| `hkstp-company-directory` | 1,298 | Stable sitemap/HTML |
| `startgate-um6p` | 1,912 | Africa; 119 NEEDS_REVIEW in Admin |
| `j-startup` | 268 | Japan government list |
| `hub71-startup-directory` | 316 | Fix + repair canonical URLs |
| `afrilabs` | 521 | 0 new = backlog already ingested |
| `birac-technology-portal` | 53 | India biotech portal |
| `dcamp-startup-directory` | 12 | Korea (small) |

### Disabled in this PR (30 sources)

Zero-discover, fetch-fail, Wayback 404, or JS-only portfolio — see `# DISABLED: Oct 2026 probe` comments in `config/sources.yaml`. Includes user-listed zero-discover Asia queue slugs + `baobab-network` (0 refs until PR **#85** Vite bundle discover lands).

### Baobab / #85

**PR #85** (draft) adds Vite-bundle discover (~62 companies). On `main`, probe gets **0** refs (client-rendered portfolio). **Disable** until #85 merges or adapter fixed.

---

## 5) Next high-volume additions (Asia/Africa, verified egress)

| Rank | Source | URL / method | ~Count | Gate (sample) | Recommend |
|-----:|--------|--------------|-------:|---------------|-----------|
| 1 | `hkstp-company-directory` | Already enabled | 1,298 | Good | **Keep** — nightly incremental |
| 2 | `startgate-um6p` | Already enabled | 1,912 | NEEDS_REVIEW noise | **Keep** — drain review separately |
| 3 | `hub71-startup-directory` | `all-startups` JSON | 316 | ~211/316 pass listing | **Fix** + ingest after deploy |
| 4 | Bioeconomy Corp Malaysia (new) | `bioeconomycorporation.my/wp-json/wp/v2/posts` | **856** | Mostly news | **Investigate** category filter |
| 5 | `j-startup` | Enabled | 268 | Verified | **Keep** |

**Unreachable from Cloud Agent** (re-probe from Railway): Startup India API, MYStartup Malaysia, Seoul hubs, Startup Nation Central.

---

## 6) Expected next 04:00 UTC cron (after this PR)

| Change | Effect |
|--------|--------|
| Solar paused | **~60 min** returned to other sources |
| 30 dead Asia/Africa sources disabled | Faster pass; less SKIPPED/zero-discover noise |
| Failure circuit | Solar-like 429 storms stop at **25** failures, not 1,280 |
| Hub71 repair + logging | First successful run → up to **~211** new AUTO_INGESTED-class rows (if legacy URLs repaired) |

**Order-of-magnitude new resources:** **200–400** if Hub71 + HKSTP pending run; otherwise **0–50** from incremental HKSTP/J-Startup unless pending queues are empty.
