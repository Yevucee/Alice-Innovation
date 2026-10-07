# Migration `018_quality_audit_verified` (production)

Adds `resources.quality_audit_verified_at` and a partial index for rows that passed a verified quality repair.

## Check whether it is applied

On the **production** Postgres shell (Railway `pgvector` or MCP with `DATABASE_URL`):

```sql
SELECT version, applied_at
FROM schema_migrations
WHERE version = '018_quality_audit_verified.sql'
   OR version = '018_quality_audit_verified';
```

If this returns **no rows**, migration 018 is **not** applied.

You can also confirm the column exists:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'resources'
  AND column_name = 'quality_audit_verified_at';
```

## Apply migration 018 (if missing)

From a machine or Railway service that has the repo and production `DATABASE_URL`:

```bash
cd /path/to/Alice-Innovation
npm run migrate
```

That runs all pending files under `database/migrations/` in order, including `018_quality_audit_verified.sql`.

To apply **only** via SQL (emergency / manual):

```bash
psql "$DATABASE_URL" -f database/migrations/018_quality_audit_verified.sql
INSERT INTO schema_migrations (version) VALUES ('018_quality_audit_verified.sql')
ON CONFLICT DO NOTHING;
```

(Use the same `version` string your deploy already stores — check an existing row in `schema_migrations` for the naming pattern.)

## After apply

Re-run the post-deploy job **`title_case_repair_202610`** (migration `019`) or a cleanup-first ingest so title repair can set `quality_audit_verified_at` on cleared rows.
