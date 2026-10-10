-- Scoped ingest triggers from admin (no Railway persistent env changes).

CREATE TABLE IF NOT EXISTS ingest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  trigger text NOT NULL DEFAULT 'admin-button',
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  items_new integer,
  duration_ms integer,
  CONSTRAINT ingest_requests_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS ingest_requests_status_requested_idx
  ON ingest_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS ingest_requests_scope_requested_idx
  ON ingest_requests (scope, requested_at DESC);
