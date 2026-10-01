ALTER TABLE embedding_backfill_runs
  ADD COLUMN IF NOT EXISTS priority_queued integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_embedded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_failed integer NOT NULL DEFAULT 0;
