# Ingest volume programme — step (e) report

Date: 2026-10-07 (Cloud Agent). **PR #67** is merged on `main`. Follow-up work is split across draft PRs **#69–#71** and **#72** (step d).

## Deploy and migrations (#67)

| Question | Answer |
|----------|--------|
| **Migration for #67?** | **No.** Code + `config/sources.yaml` only (`inferCataloguePathPatternFromCollectionUrl`, HKUST, SGInnovate hook, failure matrix). |
| **Web + ingestor deployed?** | This agent **cannot read Railway deploy state**. After squash-merge, Railway should rebuild **web** (`railway.web.toml`) and **ingestor** (`railway.ingestor.toml`) from `main`. Confirm in the Railway dashboard or run `npm run smoke:production:remote` locally with production env. |
| **Migrations after #69 merges?** | **Yes — `023_ingestion_runs_pipeline_stats.sql`** when step (a) merges. Run `npm run migrate` on production DB before relying on loss reports. |

**Policy:** All **85** Asia sources remain `enabled: true` in YAML.

---

## Step PRs (approve separately)

| Step | PR | Branch | Summary |
|------|-----|--------|---------|
| **(a)** Loss attribution | [#69](https://github.com/Yevucee/Alice-Innovation/pull/69) | `cursor/ingest-loss-attribution-c446` | `pipeline_stats`, `duplicate_of` skip, cross-source reuse metrics, `report-ingest-source-losses` |
| **(b)** First-run cap | [#70](https://github.com/Yevucee/Alice-Innovation/pull/70) | `cursor/ingest-first-run-cap-c446` | Default limit **80 → 500**, per-source `limits.first_run_item_limit` |
| **(c)** Asia adapters | [#71](https://github.com/Yevucee/Alice-Innovation/pull/71) | `cursor/asia-adapter-volume-c446` | HKSTP bespoke attempt, Circulate URL, Astana slug routing |
| **(d)** High volume | [#72](https://github.com/Yevucee/Alice-Innovation/pull/72) | `cursor/high-volume-sources-c446` | Startgate `catalogue_nav_boilerplate` fix, volume proposal doc |

---

## (a) Why discovered ≫ items_new (your examples)

Admin **items_new** = **new `resources` rows**, not listing rows or updates.

| Source | Discovered (typical) | items_new | Why dropped / not counted as new |
|--------|----------------------|-----------|-----------------------------------|
| `j-startup-impact` | 269 | 0 | Duplicate catalogue of `j-startup`; same URLs → **cross-source reuse** (update only). Fix: skip ingest when `duplicate_of` sibling has items (#69). |
| `birac-technology-portal` | 53 | 0 | Hub/listing pages, **first-run cap 80**, parse/junk failures; few real company detail URLs. Cap lift (#70) + path patterns (#67). |
| `atal-innovation-mission` | 58 | 1 | Government hub links; most URLs are not portfolio detail pages. |
| `hkstp-company-directory` | 63 | 24 | Nav URLs (`/en/discover`), **limit**, failures; partial directory hits. SPA listing still weak (#71). |
| `nia-innovation-catalogue` | 49 | 0 | Same homepage as `nia-thailand` → **cross-source reuse** / duplicate catalogue. |

After **#69** + migrate: `npm run report:ingest-losses` (or `npx tsx scripts/report-ingest-source-losses.ts --category=asia-innovation`) breaks down `dropped_limit`, `cross_source_reuse`, `detail_skipped`, etc. per run.

---

## (d) High-volume sources — dry-run snapshot (Oct 2026 egress)

**Already enabled** — prioritize `--full` ingest (thousands potential):

| Source | Region | Discovered (dry-run) | Expected new (order of mag.) | Risk |
|--------|--------|----------------------|------------------------------|------|
| `mit-solve` | Global | **25,035** | 1,000+ after cap/quality | Generic titles; needs enrich |
| `solar-impulse` | Global | **2,127** | 500–2,000 | Long URLs; EN solutions |
| `startgate-um6p` | Africa | **1,912** | 1,500+ after junk fix (#72) | og:description nav noise — **fixed in #72** |
| `atlas-of-the-future` | Global | **948** | 800+ | Title often “Atlas of the Future” |
| `j-startup` | Asia | **268** | 200+ with cap **500** (#70) | Clean samples |
| `ventures-platform` | Africa | **80** | 60–80 | Some generic titles |
| `project-drawdown` | Global | **138** | 100+ | Explorer pages |
| `digital-africa` | Africa | **68** | 50–68 | FR titles “L’équipe de” |
| `wipo-green` | Global | **25**/API page | Hundreds (paged API) | API rate limits |
| `wavemaker-partners-portfolio` | Asia | **12** | ~12 | Small but clean |

**Discover 0 today (fix in #71 / matrix):** `iterative-demo-day`, `insignia-ventures-partners`, `kaust-scalex-portfolio`, `hkstp-company-directory` (SPA).

**Blocked / skip:** `norrsken-100` (401), Startup India (403), `engineering-for-change` (bot wall) — see `docs/asia-source-failure-matrix.md`.

**15–25 brand-new YAML registrations** (EU Innovation Radar, SBIR bulk, etc.) need **new adapters** — tracked as phase 2 in `docs/high-volume-sources-proposal.md`; not enabled without dry-run pass.

---

## Expected impact after you merge #69–#72 and run full Asia + global backfill

| Lever | Approx. new resources |
|-------|------------------------|
| Cap 500 + j-startup 300 (#70) | +400–800 Asia |
| Startgate + Atlas + Solar Impulse full run | +2,000–4,000 global |
| MIT Solve (selective / capped batches) | +1,000+ |
| Path-pattern queue on HTTP-200 Asia hubs (#67 + cap) | +500–1,500 |
| Skip duplicate slugs (#69) | Saves wasted runs; clearer metrics |

---

## Suggested merge order

1. **#69** (migrate **023** in production)
2. **#70** (rebase if `types.ts` / `sources.yaml` conflict)
3. **#71**
4. **#72**

Then: full ingest per `docs/railway-checklist.md` / your ops scripts; re-check admin run stats and `report-ingest-source-losses`.
