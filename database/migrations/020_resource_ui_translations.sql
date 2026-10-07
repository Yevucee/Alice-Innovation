CREATE TABLE IF NOT EXISTS resource_ui_translations (
  resource_id uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  target_language text NOT NULL,
  source_fingerprint text NOT NULL,
  translated jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_id, target_language)
);

CREATE INDEX IF NOT EXISTS resource_ui_translations_fingerprint_idx
  ON resource_ui_translations (resource_id, target_language, source_fingerprint);
