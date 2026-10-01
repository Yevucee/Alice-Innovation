CREATE TABLE IF NOT EXISTS embedding_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  embedded integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  pct_embedded numeric(6, 2) NOT NULL DEFAULT 0,
  safety_check_passed boolean NOT NULL DEFAULT false,
  aborted boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS embedding_backfill_runs_completed_idx
  ON embedding_backfill_runs (completed_at DESC);
