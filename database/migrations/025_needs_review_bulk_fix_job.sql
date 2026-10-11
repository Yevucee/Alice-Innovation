INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'needs_review_bulk_fix_202510',
    'Bulk repair NEEDS_REVIEW (dry-run by default; set NEEDS_REVIEW_BULK_FIX_APPLY=true on alice-ingestor to apply). See docs/needs-review-bulk-fix.md',
    9
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 9, updated_at = now()
  WHERE job_key = 'needs_review_bulk_fix_202510';
