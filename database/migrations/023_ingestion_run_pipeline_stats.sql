ALTER TABLE ingestion_runs
  ADD COLUMN IF NOT EXISTS pipeline_stats jsonb NOT NULL DEFAULT '{}'::jsonb;
