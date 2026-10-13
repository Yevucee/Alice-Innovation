# South America wave-2 catalogue candidates (HTTP research)

**Method:** Plain `curl` with `User-Agent: AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)`, `redirect: follow`, ~2.5s delay between hosts. **No JavaScript.** Same posture as the ingestor `fetchText` client.

**Quality bar (research):** real title; description ≥2 sentences / ~150 chars on **detail HTML**; **≥20** list items (3 listing pages max). **403 / 429 / bot wall → BLOCKED** (no bypass).

**Overlap note:** `config/sources.yaml` has **no** `100 Open Startups`, Cubo, or Sebrae entries today; Sebrae would still overlap conceptually with future Brazilian startup catalogues and any general `ORGANISATION` portfolios.

---

## Summary table

| # | Candidate | List URL (final) | HTTP | robots.txt | List in HTML? | Est. items (≤3 pages) | Detail pattern | Quality (title / desc / ≥20) | Freshness | Duplicate risk |
|---|-----------|------------------|------|------------|---------------|------------------------|----------------|------------------------------|-----------|----------------|
| 1 | Sebrae Vitrine Startups | `https://vitrine.sebraestartups.com.br/` | **200** | **404** at `/robots.txt` (HTML 404 page) | **No** (Next.js/RSC) | **0** in HTML; ~11 names in RSC payload only | Unknown (client routes) | **FAIL** — no list, no descriptions | n/d | High vs future BR startup catalogues |
| 2 | UFMG CTIT Vitrine | `https://ctit.ufmg.br/vitrine-tecnologica` | **000** (DNS/connect) | n/a | n/a | n/a | n/a | **BLOCKED** | n/a | Low |
| 3 | Red Innovación CUECH | `https://redinnovacion.uestatales.cl/portafolio-de-tecnologias-new/` | **200** | **200** allow (`/wp-admin/` disallowed) | **Partial** (titles) | ~**10–15** visible titles | No stable detail URLs in HTML | **FAIL** — thin/ missing detail prose | 2024–2026 site | Low |
| 3b | CUECH (legacy) | `https://redinnovacion.uestatales.cl/proyectos/` | **200** | **200** | **Yes** (titles) | **9** | Single-page sections | **FAIL** — descriptions not ≥2 sentences | n/d | Low |
| 4 | UdeA portafolio | `https://www.udea.edu.co/wps/portal/udea/web/inicio/extension/portafoliotecnologico` | **200** | **200** (long Disallow list; portfolio path **not** disallowed) | **Partial** | **4** `articulos` links in HTML (site claims 80+) | `/portafoliotecnologico/articulos/{slug}` | **FAIL** — &lt;20 items; detail body not in HTML | 2026 event pages elsewhere | Low |
| 5 | USP Vitrine | `https://vitrine.rp.usp.br/portfolio/` | **200** | **404** at `/robots.txt` | **Partial** (slug links only) | **~32** slugs (home + area filters) | `/portfolio/{slug}` | **FAIL** — Nuxt; detail description **not** in server HTML | n/d | Low |
| 6 | GRIDX portfolio | `https://www.gridexponential.com/portfolio` | **200** | **200** `Allow: /` | **Yes** | **~84** (`Visit Website` blocks) | External company sites (no on-site detail) | **PASS** list; detail is off-site | n/d | Medium (global VC portfolio) |
| 7 | HUBTEC portfolio | `https://www.hubtec.cl/portafolio-hubtec/` + histórico | **200** | **200** (Yoast; sitemap linked) | **Partial** (names) | **~18** fichas (histórico) | **PDF** `FICHA_*.pdf` | **FAIL** — descriptions in PDFs, not HTML | 2025 PDF paths | Low |
| 8 | Next Argentina (Cancillería) | (no catalogue URL found) | **404** / **403** on probes | n/a | **No** | **0** | n/a | **BLOCKED** / **FAIL** | n/a | n/a |
| 9 | NESsT portfolio | `https://www.nesst.org/portfolio` | **200** | **200** (Squarespace) | **No** | **0** in HTML | `/portfolio-gallery?category={country}` | **FAIL** — JS gallery | n/d | Medium (multi-country) |
| 10 | UNC Oferta tecnológica | `https://ofertatecnologica.secyt.unc.edu.ar/capacidades-tecnologicas` | **200** | Not fetched (Drupal subsite) | **Yes** | **~30** unique `/node/{id}` (3 pages) | `/node/{id}` | **PASS** (see samples) | n/d on nodes | Low |
| 11 | UChile Portal (not UC Transferencia) | `https://transferencia.uchile.cl/` | **000** / **404** on `uchile.cl` paths | n/a | **No** | **0** | n/a | **BLOCKED** | n/a | Overlaps UChile transferencia when fixed |
| 12 | Fiocruz portfolio | `https://portfolioinovacao.fiocruz.br/?lang=pt` | **200** | **404** at `/robots.txt` | **No** (no post list) | **0** in HTML | `?page_id=` / unclear `?p=` | **FAIL** — stale years in HTML (**2014–2016**); no catalogue | **Stale** | Low |
| 13 | IDB Lab / IDB projects | `https://www.iadb.org/en/idblab/projects` | **403** | n/a | **No** | **0** | n/a | **BLOCKED** | n/a | Low if filtered to IDB Lab SA |

---

## Per-candidate notes

### 1. Sebrae Vitrine (`vitrine.sebraestartups.com.br`)

- **Terms:** Privacy PDF linked in footer JSON: `https://minio-cpe.sebrae.com.br/documento/politica-privacidade.pdf` (not fetched byte-by-byte).
- **HTML:** Large Next.js shell (~236 KB); **no** `/startups` or `/busca` list (404). React streaming (`self.__next_f.push`) includes **~11** startup **names** (e.g. `2Solve`, `4intelligence`) but **not** the reported **~17,593** records.
- **Quality filter possible?** Only if a **public, robots-allowed JSON API** exists (not found in HTML). Otherwise would require JS or partnership feed — **do not ingest the full catalogue**.
- **Overlap:** Would dominate Brazilian startup coverage; filter by maturity/description would still duplicate any future `ORGANISATION`/`SOLUTION` BR sources.

### 2. UFMG CTIT (`ctit.ufmg.br`)

- **BLOCKED:** `Could not resolve host` for `ctit.ufmg.br` and `www.ctit.ufmg.br` from research egress. Public URL is likely `https://www.ctit.ufmg.br/vitrine/` per site docs — **not verified here**.

### 3. Red Innovación CUECH (`redinnovacion.uestatales.cl`)

- **Portafolio NEW:** Titles such as “Biofungicida…”, “Bioestimulante…” appear in HTML; **~2** “Ver” actions; no per-item detail URLs in static HTML.
- **Legacy `/proyectos/`:** **9** `<h3>` project titles; body text is mostly **university name** (one line) — fails description gate.

### 4. Universidad de Antioquia (`udea.edu.co`)

- List page **200**; only **four** distinct `articulos` paths in HTML. Detail URLs return **200** but article prose is loaded via **portal JS** (Dojo/GTM shell; no ≥150-char body in initial HTML).

### 5. USP Vitrine (`vitrine.rp.usp.br`)

- **~32** technology slugs across `/portfolio/` and `/portfolio/area/{area}`.
- Detail URLs e.g. `/portfolio/luva_detectora_de_pesticidas` return Nuxt payload with slug but **no** `Resumo`/description string in `__NUXT_DATA__` snapshot — treat as **SPA** for descriptions.

### 6. GRIDX (`gridexponential.com`)

- **robots:** `Allow: /`; sitemap declared.
- **List:** **~84** companies with on-page blurb + “Visit Website” (external site).
- **Terms:** `https://www.gridexponential.com/terms-and-conditions` → **200**.

**Samples (title | first ~200 chars of on-page blurb):**

1. **CASPR Biotech** — CASPR Biotech pioneers next-generation molecular diagnostics by harnessing CRISPR and novel Cas enzymes. Their portable, low-cost platform enables rapid detection of infectious diseases and antimicrobial resistance…
2. **Puna Bio** — Puna Bio harnesses extremophile bacteria that have lived on Earth for 3.5 billion years to create the world’s first extremophile bioinoculant. Their products boost crop resilience…
3. **Alkemio** — Molecular recognition technology for high efficiency rare earth separation

### 7. HUBTEC (`hubtec.cl`)

- `portafolio-hubtec/` is marketing; **`portafolio-historico-hubtec/`** lists sector buckets with names (e.g. **NANO BURBUJAS**, **APTIDA**) and **18** `Ver ficha` links to **PDF** files on `wp-content/uploads/…/FICHA_*.pptx.pdf` — same class of issue as PUCV document download.

### 8. Next from Argentina

- No dedicated “Next” portfolio URL located on `argentina.gob.ar` from HTTP probes. **403** on `…/exportar-conocimiento` path variant. Recommend **ORGANISATION-only** metadata ingest only if a stable HTML directory appears; descriptions likely one sentence.

### 9. NESsT (`nesst.org`)

- `/portfolio` and `/portfolio-gallery?category=Brazil|Chile|Colombia|Ecuador|Peru` return **200** but **no** portfolio item links in HTML (Squarespace JS). **Terms:** `/terms-of-use` **200**.

### 10. UNC Oferta tecnológica (`ofertatecnologica.secyt.unc.edu.ar`)

- **Pagination:** `?page=0,1,2` — **30** unique node IDs.
- **Detail:** `https://ofertatecnologica.secyt.unc.edu.ar/node/{id}` → **200**; title in page text; multi-sentence description in HTML.

**Samples:**

1. **Barreras aislantes para la contención de contaminantes** — Diseño de barreras y nuevos materiales para la construcción de barreras para la contención de liquidos contaminantes en relleno sanitarios, lagunas de estabilización y para…
2. **Evaluación de propiedades térmicas de suelos y rocas** — Estudio y caracterización de geomateriales. Campos de aplicación Ambiente Construcción Energía Nuevos materiales…
3. (Third node on list) **Gestión previsional de infecciones gastrointestinales y hepatitis en aguas superficiales** — (body continues on `/node/…`; multi-sentence in HTML)

### 11. Universidad de Chile — Portal UChile

- **Not** the same as UC Transferencia (`transferenciaydesarrollo.uc.cl`) already in wave-1. **Connection failures / 404** on probed `uchile.cl` and `transferencia.uchile.cl` paths.

### 12. Fiocruz (`portfolioinovacao.fiocruz.br`)

- Homepage **200** but **no** technology cards linked as `?p=` posts in HTML; visible copyright years **2014–2016**. Needs fresh WordPress export or admin feed; flag **freshness** if ever enabled.

### 13. IDB Lab / IDB projects

- **BLOCKED:** `https://www.iadb.org/en/idblab/projects` and `https://www.iadb.org/en/idblab` → **403** from research egress. Do **not** ingest whole IDB DB; scope to **IDB Lab/MIF + South America** only if a public non-403 API/HTML appears.

---

## Recommended second-wave order

1. **GRIDX** (`gridexponential.com/portfolio`) — only candidate with **≥20** items and prose in HTML; accept off-site “detail”.
2. **UNC Oferta tecnológica** — Drupal HTML works; **30** nodes; implement `/node/{id}` parser.
3. **Red CUECH** — revisit if detail pages become server-rendered on `portafolio-de-tecnologias-new/`.
4. **USP Vitrine** — only if Nuxt exposes a public JSON API for portfolio bodies (not found).
5. **Fiocruz** — only with freshness metadata + working post list (REST or HTML).
6. **UdeA** — only with IBM portal bypass or alternate static export.
7. **HUBTEC** — only if HTML summaries replace PDF fichas.
8. **NESsT** — only if Squarespace JSON block becomes accessible without JS rendering.
9. **Sebrae** — last; capped subset + explicit API/partnership; never full 17k.
10. **IDB / UFMG / Next / UChile portal** — blocked until egress/terms/path resolved.

---

## Registry

See `docs/south-america-candidates-rejected.md` for hold/reject slugs to avoid rediscovery.
