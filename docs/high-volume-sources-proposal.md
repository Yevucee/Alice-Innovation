# High-volume source proposal (step d)

Dry-run `adapter:sample-dry-run --limit=5` from Cloud Agent egress, Oct 2026.

## Already enabled — prioritize full ingest

| Source | Region | Discovered (sample) | Est. catalogue | Risk |
|--------|--------|---------------------|----------------|------|
| `mit-solve` | Global | **25035** | Tens of thousands listed | Enable batched full ingest; generic “SIMA”-style titles — enrich |
| `solar-impulse` | Global | **2127** | ~2k solutions | impulse-foundation sitemap; long paths |
| `startgate-um6p` | Africa | **1912** | ~2,880 startups | og:description nav noise — fixed in step d PR (use main body) |
| `atlas-of-the-future` | Global | **948** | ~950 projects | Generic titles “Atlas of the Future” — enrich/title cleanup |
| `j-startup` | Asia | **268** | 269 | Verified adapter |
| `wipo-green` | Global | **25**/page API | Hundreds (paged API) | Rate limits; good quality |
| `wavemaker-partners-portfolio` | Asia | **12** | Small VC list | Low volume but clean |
| `solar-impulse` | Global | (sitemap) | ~100 EN solutions | Partial metadata |
| `project-drawdown` | Global | Large | 100+ solutions | Already in library |
| `mit-solve` | Global | Medium | Challenges + solvers | Mixed types |

## Enable / fix next (hundreds each)

| Source | Action | Est. items | Risk |
|--------|--------|------------|------|
| `astana-hub-company-network` | Fix discover URL (avoid `/community` 404) | 200+ | SPA/API |
| `startup-philippines-directory` | Path fix (#67) + full run | 100+ | Gov site drift |
| `iit-bombay-innovation` | Generic path under collection | 50–200 | Hub vs company pages |
| `nus-enterprise-innovation` | `/startups` listing | 100+ | Duplicate slug with `nus-enterprise` |
| `kaust-scalex-portfolio` | Verify ScaleX HTML paths | 50+ | |
| `insignia-ventures-partners` | Portfolio adapter | 80+ | |
| `iterative-demo-day` | `/companies` | 100+ | |

## Not recommended (blocked or low ROI)

| Source | Reason |
|--------|--------|
| `norrsken-100` | HTTP 401 from egress |
| `engineering-for-change` | Bot wall |
| `cyberport` / `adb-ventures` | HTTP 403 |
| `startup-india-*` | HTTP 403 CloudFront from agent |

## New registrations (candidates for future YAML)

Government/open-data style (verify robots + terms before enable):

1. UK Companies House open data (bulk, not HTML — separate adapter)
2. EU Innovation Radar API
3. USA SBIR award database
4. World Bank climate innovation (documents)
5. GEF / UNEP innovation portfolios (HTML)

These need dedicated adapters; not added in this PR — track as phase 2.

## Expected impact after steps a–d merges

| Phase | New resources (order of magnitude) |
|-------|-------------------------------------|
| First-run cap 500 + j-startup 300 | +400–800 Asia on next full run |
| duplicate_of skips + attribution | Fewer wasted runs; clearer metrics |
| Startgate + Atlas full `--full` | **+2,000–3,000** global |
| Asia path-pattern queue | +500–1,500 when combined with cap lift |
