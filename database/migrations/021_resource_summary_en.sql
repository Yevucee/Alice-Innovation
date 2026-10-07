-- Optional English summary filled at ingest when INGEST_TRANSLATE_SUMMARY_TO_EN is enabled (future).
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS source_summary_en text;
