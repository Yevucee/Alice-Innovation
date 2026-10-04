INSERT INTO resource_types (code, label) VALUES
  ('ARTICLE', 'Article')
ON CONFLICT (code) DO NOTHING;

INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'data_quality_repair_202510',
    'One-time data quality repair (org/summary/title/apolitical ARTICLE) + re-embed',
    4
  )
ON CONFLICT (job_key) DO NOTHING;
