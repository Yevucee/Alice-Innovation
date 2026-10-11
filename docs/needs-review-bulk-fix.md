# NEEDS_REVIEW bulk fix (post-deploy job)

Job key: `needs_review_bulk_fix_202510` (migration `025`).

## Default: dry-run only

On the next ingestor post-deploy pass the job **does not write** to `resources` unless you opt in.

- **Dry-run (default):** scans batches, accumulates totals and up to **20** before→after title samples, logs `needs_review_bulk_fix_summary`, and stores `dry_run_summary` on the job **result** (visible in **Admin → Post-deploy jobs**).
- **Apply modes** on **`alice-ingestor`** only:

```bash
# Apply only rows that fully clear (recommended first pass)
NEEDS_REVIEW_BULK_FIX_APPLY=cleared-only

# Apply clears, source_limited, hide, and partial updates
NEEDS_REVIEW_BULK_FIX_APPLY=all
# (legacy: true / 1 / yes — same as all)
```

Unset or `false` after a one-off apply if you do not want accidental writes on later ingests.

**Hide** uses the same mechanism as Admin review queue **Hide** (`active=false`, `review_status=ARCHIVED`), **appending** junk reason codes to existing `review_reason_codes`. Up to **100 hide samples** (with source URL) appear in the job summary under `hide_samples` (Admin post-deploy note uses a scrollable pre).

**Restore:** `scripts/restore-bulk-fix-hidden.ts` or Admin → Review → **Restore all bulk-fix hidden** (rows with `junk_*` codes).

## Manual script (same rules)

```bash
# Dry-run (no env required)
scripts/run-with-production-env.sh npx tsx scripts/needs-review-bulk-fix.ts

# Apply (requires NEEDS_REVIEW_BULK_FIX_APPLY=true on the shell env / ingestor)
scripts/run-with-production-env.sh env NEEDS_REVIEW_BULK_FIX_APPLY=true npx tsx scripts/needs-review-bulk-fix.ts --apply
```

AfriLabs-only repair: `scripts/afrilabs-needs-review-repair.ts` (same dry-run / apply pattern).

## Samuel workflow

1. Deploy PR with migration `025` (job registered, still dry-run).
2. Run one ingest or wait for post-deploy; read **Admin** summary or Railway logs for `needs_review_bulk_fix_summary`.
3. If counts look right, set `NEEDS_REVIEW_BULK_FIX_APPLY=true`, re-run the job (or script with `--apply`), then unset the var.

When `NEEDS_REVIEW_BULK_FIX_APPLY` changes (e.g. dry-run → `cleared-only` → `all`) **or** the bulk-fix **algorithm version** bumps (see `BULK_FIX_ALGORITHM_VERSION` in code) after a completed run, the post-deploy runner **re-queues** `needs_review_bulk_fix_202510` (`status=pending`, progress reset). The Admin summary shows `algorithm_version=…`, `run_mode=…`, and `restarted_from=…` / `algo_restarted_from=…` when that happens.

See `docs/needs-review-bulk-fix-source-analysis.md` for mit-solve / afrilabs / hundred / j-startup follow-up notes.

Paging uses **keyset** (`last_id`) not `OFFSET`, so rows that leave `NEEDS_REVIEW` during apply are not skipped.
