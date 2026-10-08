# Open volume report (updated 2026-10-08)

**#82 merged** (Hub71 JSON, Circulate URL, YC adapter disabled). Follow-up PR: single CORDIS source + `/search/en` API, YC quality drops, MIT Solve discover notes.

**No DB migration** required for any of this work.

Artifacts: `yc-quality-samples.log`, `cordis-rejected-examples.log`, `cordis-pipeline-simulate-v2.log`, `mit-solve-discover-audit.log`, `production-smoke.log`.

---

## Y Combinator OSS (`ycombinator-oss-companies`, **disabled**)

- Catalogue: **6,279** companies (`yc-oss.github.io` JSON).
- **500/run cap** via `max_items_per_run` / `first_run_item_limit` in `sources.yaml`.
- **Rejected at quality gate** → `IngestQualityDropError` (counted as `items_failed`, **no** `NEEDS_REVIEW` row).
- Enable only after you approve samples below.

### Pass quality gate (20)

| Title | URL | Summary (trimmed) |
|-------|-----|-------------------|
| Fanvibe | http://fanvibe.com/ | Check-in to games to chat and trash-talk with friends… |
| Mertado | http://mertado.com/ | Social shopping platform for community-based buying… |
| Fabricly | http://fabricly.com/ | Marketplace for apparel manufacturers and materials… |
| Embedly | http://embed.ly/ | Platform for embedding and previewing links… |
| Nowmov | http://nowmov.com/ | Endless stream of recommended videos… |
| Answerly | http://answerly.com/ | Engage customers by answering their questions… |
| Zenedy | http://zenedy.com/ | Showcase information about obscure topics… |
| Gamador | http://gamador.com/ | Social game developer… |
| Cardpool | http://cardpool.com/ | Gift card exchange marketplace… |
| Etacts | http://etacts.com/ | Keep in touch with growing contact lists… |
| Data Marketplace | http://datamarketplace.com/ | Find, buy and sell data online… |
| Newslabs | http://newslabs.com/ | Platform helping journalists adapt to the web… |
| Infoharmoni | http://infoharmoni.com/ | Data visualization for real-time social web… |
| Notifo | http://notifo.com/ | Mobile notifications for any web service… |
| DailyBooth | http://dailybooth.com/ | Real-time photo/status updates… |
| Jobspice | http://jobspice.com/ | Resume creation tool… |
| Plurchase | http://plurchase.com/ | Social shopping overlay on e-commerce sites… |
| Flightcaster | https://www.ycombinator.com/companies/flightcaster | Predicts flight delays… |
| Wakemate | http://wakemate.com/ | Personalized alarm clocks synced to sleep… |
| Instantq | http://instantq.com/ | JIT restaurant promotions… |

### Fail quality gate (10) — dropped on ingest, not NEEDS_REVIEW

| Title | URL | Reason |
|-------|-----|--------|
| CircuitHub | https://circuithub.com/ | `short_description` |
| iCracked | http://icracked.com/ | `short_description` |
| 42Floors | http://42floors.com/ | `short_description` |
| PlanGrid | http://plangrid.com/ | `short_description` |
| WireOver | http://wireover.com/ | `short_description` |
| The Muse | http://themuse.com/ | `short_description` |
| SendHub | http://sendhub.com/ | `short_description` |
| Hipmob | http://hipmob.com/ | `short_description` |
| MyVR | http://myvr.com/ | `short_description` |
| HireArt | http://hireart.com/ | `short_description` |

Regenerate: `npx tsx scripts/yc-quality-samples.ts`

---

## CORDIS — collapsed to one enabled source

| Before | After |
|--------|--------|
| 3× enabled (`horizon-europe`, `horizon-2020`, `eic-accelerator`) on broken `/api/search/results` | **1×** `cordis-eu-research-projects` on **`/search/en?format=json`** with `q=contenttype=project` (~**59,396** projects) |

**Root cause:** legacy endpoint returned mostly **articles** and ignored programme filters (same `total≈1.23M`). The site UI uses `/search/en` with Lucene `q=` (e.g. `contenttype=project`); programme filters work there (`HORIZON` ≈ 24k — not enabled as separate sources).

**Innovation filter (~22% pass on real projects, 110/500 in simulation):** requires a keyword like *innovation*, *startup*, *market*, *SME*, *Horizon*, etc., and rejects admin-only wording (*work programme*, *grant agreement*, …).

### 10 rejected examples (page 1)

1. Support towards the Europe PMC initiative… — `no_innovation_signal`
2. Light Night — `no_innovation_signal`
3. Geometric problems in PDEs with applications to fluid mechanics — `no_innovation_signal`
4. European Researchers' Night in Madrid 2014-2015 — `no_innovation_signal`
5. EuroMix — `no_innovation_signal`
6. Toolless Manufacturing of Complex Structures — `no_innovation_signal`
7. Science@Aveiro… — `no_innovation_signal`
8. DREAMS European Researcher's Night — `no_innovation_signal`
9. European Researchers' Night: Researchers' For a Better Future — `no_innovation_signal`
10. Life is Science, Science is Life… — `no_innovation_signal`

Still tagged **`grant_record: true`** → browse-hidden like other grant catalogues. **Do not enable NIH/NSF/UKRI/World Bank** for volume unless you accept the same pattern.

Scripts: `cordis-pipeline-simulate.ts`, `cordis-rejected-examples.ts`, `cordis-run-analysis.ts`

---

## MIT Solve discover (~25,034 URLs)

Discover matches **only** canonical `https://solve.mit.edu/solutions/{id}` from `sitemap.xml` (no child-sitemap expansion). Random audit (**10/10**): HTTP 200, `h1.heading-2` solution profile pages (e.g. Recidivism Crushers, Project Vidya Shakti).

**Why 25k vs “few thousand” curated solvers:** MIT’s sitemap lists **~25k application/solution profile IDs** (max id ~113k, sparse). The smaller public “Meet the Solvers” list is **not** a separate machine-readable catalogue — it does not link `/solutions/{id}` in HTML. Ingest cap (`INGEST_ITEM_LIMIT=500`) and checkpoints limit how many are in DB; discover count is not a bug.

Script: `npx tsx scripts/mit-solve-discover-audit.ts`

**Backfill vars (unchanged):** `INGEST_ONLY_SOURCES=mit-solve` + `INGEST_ITEM_LIMIT=500` (repeat) or `INGEST_FULL=true` with time budget.

---

## Grant-style open data (not enabled)

NIH / NSF / UKRI / World Bank remain **`enabled: false`**. If enabled later for raw count, expect **`grant_record`** (or programme) tagging and **browse-hidden** behaviour like CORDIS — not public catalogue growth.

---

## Hub71 / Circulate (merged #82)

Hub71: JSON `/all-startups` path. Circulate: `collection_url` → `/companies/`. Run: `INGEST_ONLY_SOURCES=hub71-startup-directory,hkstp-company-directory,circulate-capital` + `INGEST_FULL=true`.

---

## Scripts index

| Script | Purpose |
|--------|---------|
| `yc-quality-samples.ts` | 20 pass + 10 fail YC rows |
| `cordis-rejected-examples.ts` | Innovation-filter rejections |
| `cordis-pipeline-simulate.ts` | Discover/filter simulation |
| `mit-solve-discover-audit.ts` | Random solution URL probe |
| `open-data-volume-probe.ts` | Bulk candidate dry-run |
| `source-yield-rank.ts` | Enabled source yield |
| `backfill-remaining-estimate.ts` | Atlas / solar / mit-solve |
