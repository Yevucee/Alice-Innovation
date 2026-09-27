# Enabling a paused source (“Other resources” → Indexed)

You can connect another catalogue source to automatic ingest when these are true:

1. **Public access** — no login, paywall, or bot wall (or you have a partner feed we can use instead of crawl).
2. **Verified `collection_url`** in `config/sources.yaml` (HTTP 200 for the listing or a documented API/sitemap).
3. **Adapter** — either extend `remaining-catalogue-adapters` / `catalogue-adapters`, or confirm the placeholder adapter id matches `adapter:` in YAML.
4. **Robots** — `robots.txt` must allow the paths we fetch (or document `skipRobotsGuard` only for API-only adapters like WIPO GREEN).
5. **Flip in YAML** — `enabled: true`, `status: PARTIAL`, update `discovery.notes` and `coverage.notes`.
6. **Seed DB** — run `npm run seed` (or deploy) so `sources` table matches YAML.
7. **Ingest** — `npm run ingest -- --source <id> --limit 80` then `--full` when discovery is complete.

Only **one** production ingest should run at a time (Postgres advisory lock). Use:

```bash
npm run ingest:single-flight:remote
```

Do **not** start overlapping `ingest-step*` tmux sessions.
