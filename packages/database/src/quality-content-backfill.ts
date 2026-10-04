import type { Queryable } from "./pool.js";
import { truncateAtWordBoundary } from "@alice/shared";

const BATCH = 30;

const DETAIL_REASONS = new Set(["short_description", "truncated_title", "listing_only_thin"]);

export interface QualityContentBackfillRow {
  resource_id: string;
  title: string;
  source_summary: string;
  extracted_index_text: string;
  review_reason_codes: string[];
  canonical_url: string;
  source_slug: string;
}

export async function loadQualityContentBackfillCandidates(
  db: Queryable,
  offset: number,
): Promise<QualityContentBackfillRow[]> {
  const rows = await db.query<QualityContentBackfillRow>(
    `SELECT r.id::text AS resource_id,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            r.review_reason_codes,
            si.canonical_url,
            s.slug AS source_slug
     FROM resources r
     JOIN resource_source_links rsl ON rsl.resource_id = r.id
     JOIN source_items si ON si.id = rsl.source_item_id
     JOIN sources s ON s.id = si.source_id
     WHERE r.active
       AND (
         r.review_status = 'NEEDS_REVIEW'
         OR cardinality(r.review_reason_codes) > 0
       )
     ORDER BY r.id
     OFFSET $1 LIMIT $2`,
    [offset, BATCH],
  );
  return rows.rows.filter((row) =>
    row.review_reason_codes.some((code) => DETAIL_REASONS.has(code))
    || row.title === row.source_summary
    || row.extracted_index_text.length < 80,
  );
}

export async function applyQualityContentUpdate(
  db: Queryable,
  input: {
    resourceId: string;
    title: string;
    summary: string;
    bodyText: string;
    reviewReasonCodes: string[];
    clearReview: boolean;
  },
): Promise<void> {
  await db.query(
    `UPDATE resources SET
       canonical_title = $2,
       source_summary = $3,
       extracted_index_text = $4,
       review_reason_codes = $5::text[],
       review_status = CASE WHEN $6 THEN 'AUTO_INGESTED' ELSE review_status END,
       embedding_content_hash = NULL,
       updated_at = now()
     WHERE id = $1::uuid`,
    [
      input.resourceId,
      truncateAtWordBoundary(input.title, 300),
      truncateAtWordBoundary(input.summary, 500),
      truncateAtWordBoundary(input.bodyText, 1500),
      input.reviewReasonCodes,
      input.clearReview,
    ],
  );
}
