ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS quality_audit_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS resources_quality_audit_verified_idx
  ON resources (quality_audit_verified_at DESC NULLS LAST)
  WHERE quality_audit_verified_at IS NOT NULL;
