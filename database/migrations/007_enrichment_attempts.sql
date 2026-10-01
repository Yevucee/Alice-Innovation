-- Per-resource enrichment attempts and clearer run metrics.

ALTER TABLE resources ADD COLUMN IF NOT EXISTS enrichment_input_hash text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS enrichment_attempted_at timestamptz;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS enrichment_model text;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS enrichment_outcome text;

ALTER TABLE enrichment_backfill_runs ADD COLUMN IF NOT EXISTS attempted int NOT NULL DEFAULT 0;
ALTER TABLE enrichment_backfill_runs ADD COLUMN IF NOT EXISTS applied int NOT NULL DEFAULT 0;
ALTER TABLE enrichment_backfill_runs ADD COLUMN IF NOT EXISTS no_data int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS resources_enrichment_pending_idx
  ON resources (enrichment_attempted_at NULLS FIRST)
  WHERE active AND review_status <> 'NEEDS_REVIEW';
