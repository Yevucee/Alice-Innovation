INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'needs_review_detail_drain_202510',
    'Detail refetch for backlog sources (dry-run by default; set NEEDS_REVIEW_DETAIL_DRAIN_APPLY=true on alice-ingestor to apply). See docs/needs-review-detail-drain.md',
    10
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 10, updated_at = now()
  WHERE job_key = 'needs_review_detail_drain_202510';
