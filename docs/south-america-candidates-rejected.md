# South America catalogue candidates — hold / rejected registry

Do not re-probe these without a documented change (site redesign, new public API, or egress fix). Complements `docs/south-america-candidates.md` (wave-2 research, Oct 2026).

## Already on hold (from prior passes)

| Slug / source | Reason |
|---------------|--------|
| Embrapa technology catalogue | HTTP **403** from automated egress; do not build |
| PUCP (Peru) | Under **20** usable items |
| IMPAQTO | Hold |
| ThalesLab | Hold |
| Aceleratec | Hold |
| CONACYT PROINNOVA | Hold |
| InnovaCITE Peru | **0** items in HTML |
| PUCV | Detail = **document download**, not HTML prose |
| Universidad San Sebastián | Hold |
| FONTAGRO | **JS-rendered** list |
| Jornada Amazônia | **JS-rendered** |
| Start-Up Chile portfolio | Hold (prior pass) |
| SF500 | Hold (prior pass) |

## Wave-2 research additions (Oct 2026)

| Candidate | Verdict | Reason |
|-----------|---------|--------|
| `ctit.ufmg.br` / UFMG Vitrine | **REJECT (blocked)** | `ctit.ufmg.br` and `www.ctit.ufmg.br` — connection/DNS failure (`HTTP 000`) from cloud egress; cannot preflight |
| `transferenciaydesarrollo.uc.cl` (UC Chile) | **In ingest PR #96** | Not repeated here; Cloudflare **403** |
| `vitrine.sebraestartups.com.br` | **HOLD** | Next.js/RSC; **no** full catalogue in HTML; only a handful of names in streamed payload; scale ~17k if JS/API |
| `vitrine.rp.usp.br` | **HOLD** | Nuxt SPA; ~**32** technology slugs in HTML but **detail prose not** in server HTML |
| `redinnovacion.uestatales.cl` (new portafolio) | **HOLD** | `/portafolio-de-tecnologias-new/` has titles in HTML but **no** stable detail URLs/descriptions in initial HTML |
| `redinnovacion.uestatales.cl/proyectos/` | **HOLD** | ~**9** items; titles in HTML; descriptions mostly **one line** (university name) |
| `udea.edu.co` portafolio | **HOLD** | IBM WebSphere portal; **4** `articulos` links in HTML; body text not in server HTML |
| `www.hubtec.cl` portafolio | **HOLD** | List shows names + **PDF** fichas (`Ver ficha` → `.pptx.pdf`), not HTML descriptions |
| `www.nesst.org/portfolio` | **HOLD** | Squarespace; country gallery pages **empty** of portfolio links in HTML (JS) |
| `www.argentina.gob.ar` (Next / Exportar Conocimiento) | **REJECT (blocked)** | No stable public catalogue URL found; probe paths **404**; `/ciencia/.../exportar-conocimiento` **403** |
| `www.uchile.cl` / `transferencia.uchile.cl` (Portal UChile) | **REJECT (blocked)** | **404** / connection **000**; use UC Transferencia path only when egress allows |
| `www.iadb.org` IDB Lab projects | **REJECT (blocked)** | `/en/idblab/projects`, `/en/idblab`, `/en/projects/search` → **403** from egress |
| `portfolioinovacao.fiocruz.br` | **HOLD** | Homepage HTML shows **2014–2016** dates; no `?p=` post list in HTML; `wp-json` **404** |

## Promising but not enabled (see candidates doc)

| Candidate | Notes |
|-----------|--------|
| `gridexponential.com/portfolio` | ~**84** companies in HTML; best wave-2 candidate |
| `ofertatecnologica.secyt.unc.edu.ar` | ~**30** Drupal nodes; HTML descriptions on `/node/{id}` |
