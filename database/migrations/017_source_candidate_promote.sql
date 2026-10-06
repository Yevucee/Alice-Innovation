ALTER TABLE source_candidates DROP CONSTRAINT IF EXISTS source_candidates_status_check;

ALTER TABLE source_candidates
  ADD COLUMN IF NOT EXISTS source_slug text,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

ALTER TABLE source_candidates
  ADD CONSTRAINT source_candidates_status_check
  CHECK (status IN ('RECORDED', 'QUEUED_FOR_INGEST', 'PROMOTED'));

CREATE TABLE IF NOT EXISTS promoted_source_catalogue_configs (
  source_slug text PRIMARY KEY REFERENCES sources (slug) ON DELETE CASCADE,
  site_origin text NOT NULL,
  collection_url text NOT NULL,
  path_pattern text NOT NULL,
  candidate_id uuid REFERENCES source_candidates (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_candidates_source_slug_idx
  ON source_candidates (source_slug)
  WHERE source_slug IS NOT NULL;
