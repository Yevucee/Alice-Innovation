INSERT INTO post_deploy_jobs (job_key, description, sort_order) VALUES
  (
    'title_case_repair_202610',
    'Repair ALL CAPS titles (standalone batch; reports titles_repaired)',
    8
  )
ON CONFLICT (job_key) DO NOTHING;
