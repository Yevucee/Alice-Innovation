CREATE TABLE IF NOT EXISTS source_preview_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug text NOT NULL,
  sample_limit int NOT NULL,
  dry_run boolean NOT NULL DEFAULT true,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_preview_reports_slug_created_idx
  ON source_preview_reports (source_slug, created_at DESC);

INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'org_recovery_from_source_202510',
    'Recover org names from source metadata + selective detail refetch (mit-solve first)',
    0
  ),
  (
    'quality_detail_backfill_202510',
    'Detail refetch for thin/truncated listings; title case + clear fixed NEEDS_REVIEW',
    5
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 1, updated_at = now()
  WHERE job_key = 'restore_title_matched_orgs_202510';
UPDATE post_deploy_jobs SET sort_order = 2, updated_at = now()
  WHERE job_key = 'data_quality_repair_202510';
UPDATE post_deploy_jobs SET sort_order = 3, updated_at = now()
  WHERE job_key = 'cohort_quality_audit_202510';
UPDATE post_deploy_jobs SET sort_order = 4, updated_at = now()
  WHERE job_key = 'bulk_image_backfill_202510';
UPDATE post_deploy_jobs SET sort_order = 6, updated_at = now()
  WHERE job_key = 'scraper_reingest_202510';
