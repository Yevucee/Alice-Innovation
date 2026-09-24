# Sources

All 61 approved sources are in `config/sources.yaml`. Collection URLs are included only when an HTTP request returned the page. Homepages that answered 403 are the published sites; the client did not bypass bot checks. `terms_checked` is false everywhere: robots were read for the first five where the file was reachable, and a full terms review is still required before raising rates.

Status in this delivery:

| id | status | adapter running | update |
| --- | --- | --- | --- |
| `solar-impulse` | PARTIAL | yes | WEEKLY |
| `springwise` | PARTIAL | yes | WEEKLY |
| `engineering-for-change` | BLOCKED | yes | MANUAL |
| `mit-solve` | PARTIAL | yes | WEEKLY |
| `wef-uplink` | PAUSED | no | WEEKLY |
| `xprize` | PAUSED | no | MONTHLY |
| `global-innovation-fund` | PAUSED | no | MONTHLY |
| `grand-challenges-canada` | PAUSED | no | MONTHLY |
| `challenge-works` | PAUSED | no | MONTHLY |
| `wipo-green` | PAUSED | no | WEEKLY |
| `undp-accelerator-labs` | PAUSED | no | MONTHLY |
| `what-design-can-do` | PAUSED | no | MONTHLY |
| `fao-teca` | PAUSED | no | WEEKLY |
| `access-agriculture` | PAUSED | no | WEEKLY |
| `practical-action` | PAUSED | no | MONTHLY |
| `imagine-h2o` | PAUSED | no | MONTHLY |
| `efficiency-for-access` | PAUSED | no | MONTHLY |
| `cgiar` | PAUSED | no | MONTHLY |
| `eit-food` | PAUSED | no | MONTHLY |
| `global-resilience-partnership` | PAUSED | no | MONTHLY |
| `elrha` | PAUSED | no | MONTHLY |
| `gsma-innovation-fund` | PAUSED | no | MONTHLY |
| `shell-foundation` | PAUSED | no | MONTHLY |
| `project-drawdown` | ACTIVE | yes | MONTHLY |
| `third-derivative` | PAUSED | no | MONTHLY |
| `climate-kic` | PAUSED | no | MONTHLY |
| `earthshot-prize` | PAUSED | no | MONTHLY |
| `zayed-sustainability-prize` | PAUSED | no | MONTHLY |
| `holcim-foundation` | PAUSED | no | MONTHLY |
| `biomimicry-institute` | PAUSED | no | MONTHLY |
| `africa-prize` | PAUSED | no | MONTHLY |
| `afrilabs` | PAUSED | no | MONTHLY |
| `undp-timbuktoo` | PAUSED | no | MONTHLY |
| `africa-climate-ventures` | PAUSED | no | MONTHLY |
| `catalyst-fund` | PAUSED | no | MONTHLY |
| `acumen` | PAUSED | no | MONTHLY |
| `orange-social-venture-prize` | PAUSED | no | MONTHLY |
| `ashoka` | PAUSED | no | MONTHLY |
| `skoll` | PAUSED | no | MONTHLY |
| `echoing-green` | PAUSED | no | MONTHLY |
| `cartier-womens-initiative` | PAUSED | no | MONTHLY |
| `rolex-awards` | PAUSED | no | MONTHLY |
| `elevate-prize` | PAUSED | no | MONTHLY |
| `global-good-fund` | PAUSED | no | MONTHLY |
| `acumen-academy` | PAUSED | no | MONTHLY |
| `audacious-project` | PAUSED | no | MONTHLY |
| `mulago` | PAUSED | no | MONTHLY |
| `draper-richards-kaplan` | PAUSED | no | MONTHLY |
| `co-impact` | PAUSED | no | MONTHLY |
| `macarthur-100-and-change` | PAUSED | no | MONTHLY |
| `hundred` | PAUSED | no | MONTHLY |
| `oecd-opsi` | PAUSED | no | WEEKLY |
| `nesta` | PAUSED | no | WEEKLY |
| `ideo-org` | PAUSED | no | MONTHLY |
| `ideo-design-kit` | PAUSED | no | MANUAL |
| `social-innovation-academy` | PAUSED | no | MONTHLY |
| `apolitical` | PAUSED | no | WEEKLY |
| `solutions-story-tracker` | PAUSED | no | WEEKLY |
| `reasons-to-be-cheerful` | PAUSED | no | WEEKLY |
| `atlas-of-the-future` | PAUSED | no | MONTHLY |
| `fast-company-world-changing-ideas` | PAUSED | no | MONTHLY |

## First five

### Solar Impulse Foundation / Solutions Explorer

- Status: **PARTIAL**
- Homepage: https://impulse-foundation.com/
- Collection: https://impulse-foundation.com/solutions/solutions-explorer/portfolio
- Method: sitemap
- Update: WEEKLY
- Discovery: https://solarimpulse.com/ redirects to impulse-foundation.com. English solution URLs are listed in sitemap.xml under /solutions/solutions-explorer/portfolio/solutions/. Item pages are server-rendered Angular with an ng-state JSON payload. robots.txt allows the catalogue.
- Coverage: PARTIAL: the public sitemap listed about 100 English solution URLs when checked, which may be less than the historic labelled catalogue. Sample then checkpointed backfill. No full HTML stored.

### Springwise

- Status: **PARTIAL**
- Homepage: https://springwise.com/
- Collection: not stored
- Method: html
- Update: WEEKLY
- Discovery: Homepage HTML (200) contains .tile-post cards for free-to-read innovations. robots.txt allows general crawlers with crawl-delay 10 and blocks several AI-training user agents; this library uses its own user agent. /feed/, /sitemaps.xml, /innovation-database/, and sampled article URLs returned 403 and are not used.
- Coverage: PARTIAL: titles and URLs from public listing cards only. Article bodies are not fetched when the origin returns 403. No collection URL is stored because the database path was not readable.

### Engineering for Change / Solutions Library

- Status: **BLOCKED**
- Homepage: https://www.engineeringforchange.org/
- Collection: not stored
- Method: html
- Update: MANUAL
- Discovery: The published homepage answers this client with HTTP 403 and a Cloudflare bot check. robots.txt could not be read. No collection URL is stored because no solutions path returned a real document. The adapter parser is implemented and fixture-tested, and live fetch stops rather than bypassing the wall.
- Coverage: BLOCKED until a legitimate HTTP response is available. Not silently dropped.

### MIT Solve

- Status: **PARTIAL**
- Homepage: https://solve.mit.edu/
- Collection: not stored
- Method: sitemap
- Update: WEEKLY
- Discovery: robots.txt allows crawling. /solutions returned 404; solution records are /solutions/{id} URLs in sitemap.xml. Challenge index is https://solve.mit.edu/challenges and is not treated as the solution collection. Item HTML includes the title, one-line summary, team leader, and profile answers.
- Coverage: PARTIAL: solution pages in the sitemap, not every article or challenge narrative. Evidence stage stays UNKNOWN; selection is recorded as PROGRAMME_SELECTED.

### Project Drawdown Solutions Library

- Status: **ACTIVE**
- Homepage: https://drawdown.org/
- Collection: https://drawdown.org/explorer
- Method: html
- Update: MONTHLY
- Discovery: /solutions redirects to /explorer. Explorer HTML lists /explorer/{slug} solution links. Item pages expose h1.field--name-title, .field-summary, and a classification label. robots.txt allows the explorer. Assessment label is stored as metadata, not as a deployment stage.
- Coverage: ACTIVE for the current Drawdown Explorer catalogue. Unrelated site articles and retired pages outside the explorer are out of scope. Evidence basis is INDEPENDENT_ASSESSMENT; evidence stage stays UNKNOWN.
