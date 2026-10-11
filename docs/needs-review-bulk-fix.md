# NEEDS_REVIEW bulk fix (post-deploy job)

Job key: `needs_review_bulk_fix_202510` (migration `025`).

## Default: dry-run only

On the next ingestor post-deploy pass the job **does not write** to `resources` unless you opt in.

- **Dry-run (default):** scans batches, accumulates totals and up to **20** before→after title samples, logs `needs_review_bulk_fix_summary`, and stores `dry_run_summary` on the job **result** (visible in **Admin → Post-deploy jobs**).
- **Apply:** set on **`alice-ingestor`** only:

```bash
NEEDS_REVIEW_BULK_FIX_APPLY=true
```

Unset or `false` after a one-off apply if you do not want accidental writes on later ingests.

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
