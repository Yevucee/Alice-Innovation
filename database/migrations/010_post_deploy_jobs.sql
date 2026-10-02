CREATE TABLE IF NOT EXISTS post_deploy_jobs (
  job_key text PRIMARY KEY,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sort_order int NOT NULL,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_deploy_jobs_status_sort_idx
  ON post_deploy_jobs (status, sort_order);

INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'scraper_reingest_202510',
    'One-time re-ingest of fixed Africa scraper sources (Oct 2025 deploy)',
    1
  ),
  (
    'cohort_quality_audit_202510',
    'One-time quality audit apply for legacy cohort junk',
    2
  ),
  (
    'bulk_image_backfill_202510',
    'One-time thumbnail backfill (og/json-ld + listing cards)',
    3
  )
ON CONFLICT (job_key) DO NOTHING;

ALTER TABLE enrichment_backfill_runs
  ADD COLUMN IF NOT EXISTS supplemental_pages_fetched int NOT NULL DEFAULT 0;

ALTER TABLE enrichment_backfill_runs
  ADD COLUMN IF NOT EXISTS country_applied int NOT NULL DEFAULT 0;

ALTER TABLE enrichment_backfill_runs
  ADD COLUMN IF NOT EXISTS stage_applied int NOT NULL DEFAULT 0;
