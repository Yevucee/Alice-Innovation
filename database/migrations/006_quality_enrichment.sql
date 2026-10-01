-- Quality review status, enrichment cache, and run telemetry.

ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_review_status_check;
ALTER TABLE resources ADD CONSTRAINT resources_review_status_check CHECK (review_status IN (
  'AUTO_INGESTED', 'REVIEWED', 'ALICE_PICK', 'ARCHIVED', 'NEEDS_REVIEW'
));

CREATE TABLE IF NOT EXISTS resource_enrichment_cache (
  content_hash text PRIMARY KEY,
  model text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrichment_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  processed int NOT NULL DEFAULT 0,
  enriched int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  note text
);

CREATE INDEX IF NOT EXISTS enrichment_backfill_runs_started_idx
  ON enrichment_backfill_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS quality_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  flagged int NOT NULL DEFAULT 0,
  scanned int NOT NULL DEFAULT 0,
  dry_run boolean NOT NULL DEFAULT true,
  reason_counts jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS quality_audit_runs_started_idx
  ON quality_audit_runs (started_at DESC);
