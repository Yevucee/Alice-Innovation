-- Incremental ingest: listing snapshot hash + interrupted run status.

ALTER TABLE source_items
  ADD COLUMN IF NOT EXISTS listing_content_hash text;

ALTER TABLE ingestion_runs DROP CONSTRAINT IF EXISTS ingestion_runs_status_check;
ALTER TABLE ingestion_runs ADD CONSTRAINT ingestion_runs_status_check
  CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'SKIPPED', 'INTERRUPTED'));
