# Ingestion

## Adapter interface

Each adapter implements `discover`, `fetch`, `parse`, and `normalise` (parse returns the normalised draft directly). Adapters do not import the database.

Discovery order used by the first adapters: sitemap when it lists item URLs, otherwise HTML list pages. Playwright is not a dependency.

## Pipeline

`npm run ingest` loads `config/sources.yaml` and expects those rows to be seeded.

- `--due` runs enabled sources whose update class is due. This is the cron default when no `--source` is passed.
- `--source <id>` runs that source even if it is paused or blocked.
- `--limit <n>` stops after n items. Use this for a sample.
- `--full` resumes from `backfill_checkpoints` and, only for adapters marked as a full catalogue, marks items missing from the discover set inactive after a second miss. A sample run never deactivates rows.
- `--dry-run` parses items and does not upsert them. It still needs `DATABASE_URL` for the run log and lock.

One database advisory lock stops overlapping runs. If the lock is held, the process exits successfully.

Retries cover timeouts, HTTP 429, and 5xx, with backoff. 401, 403, and 404 are not retried. robots.txt is fetched first. A 401/403 on robots, or a disallow rule, stops that source. The user agent comes from `INGESTION_USER_AGENT`.

Unchanged content hashes only bump `last_seen_at`. Exact canonical URLs link to the existing resource. The same normalised title and country on a new URL becomes `POSSIBLE_DUPLICATE` and both records are kept. Semantic neighbours closer than cosine distance 0.08 are also recorded as possible duplicates and are not merged.

## Embeddings and classification

Embeddings use an OpenAI-compatible `POST /embeddings`. No API key means the row is stored without a vector. The column is 1536 dimensions; other lengths are skipped. Re-embedding happens only when the indexed text hash changes.

The classifier, when enabled, is told that source content is untrusted and must not be followed as instructions. Its output is written only to `resource_interpretations`.

## First adapters

| Adapter | Discover | Parse |
| --- | --- | --- |
| `solar-impulse` | English solution URLs in the sitemap | `script#ng-state` solution object |
| `mit-solve` | `/solutions/{id}` in the sitemap | `h1`, summary, profile answers |
| `project-drawdown` | Links on `/explorer` | title field, `.field-summary` |
| `springwise` | `.tile-post` cards on the homepage | card title; article HTML only if the fetch is allowed |
| `engineering-for-change` | stops on the bot wall | fixture parser for title and summary |

Page text is stripped of scripts before it is stored, and stored text is capped.
