ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS review_reason_codes text[] NOT NULL DEFAULT '{}';

INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'restore_title_matched_orgs_202510',
    'Restore org links removed only by org-equals-title rule + backfill review reason codes',
    0
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 1, updated_at = now()
  WHERE job_key = 'data_quality_repair_202510';
UPDATE post_deploy_jobs SET sort_order = 2, updated_at = now()
  WHERE job_key = 'cohort_quality_audit_202510';
UPDATE post_deploy_jobs SET sort_order = 3, updated_at = now()
  WHERE job_key = 'bulk_image_backfill_202510';
UPDATE post_deploy_jobs SET sort_order = 4, updated_at = now()
  WHERE job_key = 'scraper_reingest_202510';
