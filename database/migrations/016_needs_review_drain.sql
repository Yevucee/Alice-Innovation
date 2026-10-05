ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_review_status_check;
ALTER TABLE resources ADD CONSTRAINT resources_review_status_check CHECK (review_status IN (
  'AUTO_INGESTED', 'REVIEWED', 'ALICE_PICK', 'ARCHIVED', 'NEEDS_REVIEW', 'SOURCE_LIMITED'
));

CREATE TABLE IF NOT EXISTS quality_review_backlog_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  trigger text NOT NULL DEFAULT 'post_deploy',
  needs_review_before int NOT NULL DEFAULT 0,
  needs_review_after int NOT NULL DEFAULT 0,
  cleared int NOT NULL DEFAULT 0,
  source_limited int NOT NULL DEFAULT 0,
  still_flagged int NOT NULL DEFAULT 0,
  newly_flagged int NOT NULL DEFAULT 0,
  net_change int NOT NULL DEFAULT 0,
  reason_counts_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_counts_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_report jsonb
);

CREATE INDEX IF NOT EXISTS quality_review_backlog_runs_started_idx
  ON quality_review_backlog_runs (started_at DESC);

INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'needs_review_reconcile_202510',
    'Re-run quality gate on NEEDS_REVIEW rows; clear or SOURCE_LIMITED when unfixable',
    7
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 8, updated_at = now()
  WHERE job_key = 'scraper_reingest_202510';
