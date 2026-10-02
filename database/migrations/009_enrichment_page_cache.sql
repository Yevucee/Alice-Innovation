CREATE TABLE IF NOT EXISTS enrichment_page_cache (
  url text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  status_code integer NOT NULL DEFAULT 0,
  extracted_text text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS enrichment_page_cache_fetched_idx
  ON enrichment_page_cache (fetched_at DESC);
