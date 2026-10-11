INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'needs_review_bulk_fix_202510',
    'Bulk repair NEEDS_REVIEW: title case, truncated titles, short descriptions, invalid org names (dry-run via scripts/needs-review-bulk-fix.ts first)',
    9
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 9, updated_at = now()
  WHERE job_key = 'needs_review_bulk_fix_202510';
