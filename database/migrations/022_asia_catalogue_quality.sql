INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'asia_catalogue_quality_202510',
    'Quarantine HKUST/PaySpot-style catalogue junk; clean J-Startup summaries and clear default Sensors tags',
    9
  )
ON CONFLICT (job_key) DO NOTHING;

UPDATE post_deploy_jobs SET sort_order = 10, updated_at = now()
  WHERE job_key = 'scraper_reingest_202510';
