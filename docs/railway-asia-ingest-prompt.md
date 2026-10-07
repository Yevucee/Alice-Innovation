# Copy-paste prompt for Claude (Railway / production Asia ingest)

Use this in a **Cursor Cloud Agent** or **Claude** session with Railway CLI access (`railway` logged in, project `alice-mcp` + `pgvector`).

---

## Prompt

You are operating on the **Alice Innovation Library** repo (`Yevucee/Alice-Innovation`) on branch **`main`** after the Asia acquisition merges (#60, #61, and any follow-up PR that enables generic asia-innovation adapters).

### Goal

1. **Deploy** latest `main` to Railway web + ingestor (if not auto-deployed).
2. **Run Asia URL verification** from Railway egress (not a random laptop).
3. **Run production ingest** for all **enabled `asia-innovation`** sources.
4. **Report** ingestion run summaries and library counts (Asia continent filter + per-source).

### Preconditions

- Shell on **`alice-mcp`** service (or local with `scripts/run-with-production-env.sh`).
- `DATABASE_URL` points at production Postgres.
- Migrations applied (`npm run migrate` if needed).
- Sources seeded from `config/sources.yaml` (`npm run seed` if new slugs missing in DB).

### Step 1 — Verify environment

```bash
cd /app   # or repo root on Railway shell
git log -1 --oneline
npm run typecheck
```

### Step 2 — Asia HTTP preflight (from production egress)

```bash
npm run asia:verify
```

- Read `docs/asia-source-acquisition.md`.
- If many failures, run `npm run asia:rebuild-queue` only if instructed; otherwise note failures for a follow-up PR.

### Step 3 — Adapter discover sweep (optional but recommended)

```bash
npm run asia:dry-run-wave
npx tsx scripts/asia-dry-run-all.ts
```

- Read `docs/asia-adapter-ready-slugs.json` for slugs with `discovered > 0`.
- Run spot checks: `npm run adapter:sample-dry-run -- --source=j-startup --limit=5`

### Step 4 — Confirm enabled Asia sources

```bash
npx tsx scripts/asia-list-enabled-sources.ts | wc -l
npx tsx scripts/asia-list-enabled-sources.ts | head -20
```

Expect **~85** enabled `asia-innovation` slugs (all acquisition + university queue rows except BLOCKED research sites).

### Step 5 — Production ingest (single-flight)

**Wave 1 only (fast check):**

```bash
bash scripts/ingest-production-asia-wave.sh
```

**Full Asia programme (long — use ingest single-flight):**

```bash
# Bootstrap 80 items per source (default)
bash scripts/ingest-production-asia-all-enabled.sh

# Or bootstrap only, skip --full pass:
ASIA_INGEST_FULL=0 bash scripts/ingest-production-asia-all-enabled.sh

# Tune bootstrap size:
ASIA_INGEST_LIMIT=120 bash scripts/ingest-production-asia-all-enabled.sh
```

Run inside the project's **ingest single-flight** wrapper if the repo documents one (e.g. `npm run ingest:single-flight -- bash scripts/ingest-production-asia-all-enabled.sh`).

### Step 6 — Validate

- SQL or admin: `ingestion_runs` for recent runs; check `items_new`, `items_failed`, errors.
- Web search: `/search?continent=asia&sort=newest` (relaxed quality browse on empty query).
- Optional: `npm run report:africa-browse-funnel` equivalent for Asia once a funnel script exists.

### Step 7 — Report back

Post a short summary:

- Deploy commit SHA
- Number of sources ingested / failed
- Top 5 failing sources with error stage
- Approximate count of resources with Asia continent or `asia-innovation` source link
- Whether homepage **From Asia** row has enough tiles (target: relaxed browse ≥ 30)

### Do NOT

- Crawl **BLOCKED** slugs (e27, Crunchbase, Tracxn, Dealroom, PitchBook, CB Insights, etc.).
- Enable blocked-tier sources or bypass paywalls / Cloudflare.
- Force-push git.

---

## One-liner (remote from laptop with Railway env)

```bash
bash scripts/run-with-production-env.sh bash scripts/ingest-production-asia-all-enabled.sh
```

(Requires `~/.railway/env` and linked project.)
