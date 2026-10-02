import type { Queryable } from "./pool.js";
import { enrichmentInputHash } from "./enrichment.js";

export interface EnrichmentGapCounts {
  missing_country: number;
  missing_stage: number;
}

export async function countEnrichmentGaps(db: Queryable): Promise<EnrichmentGapCounts> {
  const base = `FROM resources r WHERE r.active AND r.review_status <> 'NEEDS_REVIEW'`;
  const missingCountry = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count ${base}
     AND (r.primary_country_name IS NULL OR trim(r.primary_country_name) = '')`,
  );
  const missingStage = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count ${base} AND r.evidence_stage = 'UNKNOWN'`,
  );
  return {
    missing_country: Number(missingCountry.rows[0]?.count ?? 0),
    missing_stage: Number(missingStage.rows[0]?.count ?? 0),
  };
}

export function formatEnrichmentGapNote(
  label: string,
  before: EnrichmentGapCounts,
  after: EnrichmentGapCounts,
): string {
  return `${label}: missing_country ${before.missing_country}→${after.missing_country}; missing_stage ${before.missing_stage}→${after.missing_stage}`;
}
