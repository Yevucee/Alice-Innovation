-- Priority: data quality repair first (independent), then audit, images, scraper re-ingest.
UPDATE post_deploy_jobs SET sort_order = 1, updated_at = now()
  WHERE job_key = 'data_quality_repair_202510';
UPDATE post_deploy_jobs SET sort_order = 2, updated_at = now()
  WHERE job_key = 'cohort_quality_audit_202510';
UPDATE post_deploy_jobs SET sort_order = 3, updated_at = now()
  WHERE job_key = 'bulk_image_backfill_202510';
UPDATE post_deploy_jobs SET sort_order = 4, updated_at = now()
  WHERE job_key = 'scraper_reingest_202510';
