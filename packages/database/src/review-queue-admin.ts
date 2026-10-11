import type { Queryable } from "./pool.js";

export interface ReviewQueueRow {
  id: string;
  canonical_title: string;
  source_slug: string | null;
  canonical_url: string | null;
  review_reason_codes: string[];
  updated_at: Date;
}

export async function listReviewQueue(
  db: Queryable,
  input: {
    limit: number;
    offset: number;
    sourceSlug?: string | null;
    reason?: string | null;
  },
): Promise<{ rows: ReviewQueueRow[]; total: number }> {
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const offset = Math.max(input.offset, 0);
  const sourceSlug = input.sourceSlug?.trim() || null;
  const reason = input.reason?.trim() || null;

  const count = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM resources r
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW'
       AND ($1::text IS NULL OR EXISTS (
         SELECT 1 FROM resource_source_links l
         JOIN source_items si ON si.id = l.source_item_id
         JOIN sources s ON s.id = si.source_id
         WHERE l.resource_id = r.id AND s.slug = $1
       ))
       AND ($2::text IS NULL OR $2 = ANY(r.review_reason_codes))`,
    [sourceSlug, reason],
  );

  const rows = await db.query<ReviewQueueRow>(
    `SELECT r.id::text,
            r.canonical_title,
            (
              SELECT s.slug FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              JOIN sources s ON s.id = si.source_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC NULLS LAST
              LIMIT 1
            ) AS source_slug,
            (
              SELECT si.canonical_url FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC NULLS LAST
              LIMIT 1
            ) AS canonical_url,
            r.review_reason_codes,
            r.updated_at
     FROM resources r
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW'
       AND ($3::text IS NULL OR EXISTS (
         SELECT 1 FROM resource_source_links l
         JOIN source_items si ON si.id = l.source_item_id
         JOIN sources s ON s.id = si.source_id
         WHERE l.resource_id = r.id AND s.slug = $3
       ))
       AND ($4::text IS NULL OR $4 = ANY(r.review_reason_codes))
     ORDER BY r.updated_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset, sourceSlug, reason],
  );

  return { rows: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
}

export async function applyReviewQueueAction(
  db: Queryable,
  resourceId: string,
  action: "approve" | "source_limited" | "hide",
): Promise<boolean> {
  if (action === "approve") {
    const result = await db.query(
      `UPDATE resources SET
         review_status = 'AUTO_INGESTED',
         review_reason_codes = '{}'::text[],
         quality_audit_verified_at = now(),
         embedding_content_hash = NULL,
         updated_at = now()
       WHERE id = $1::uuid AND active AND review_status = 'NEEDS_REVIEW'`,
      [resourceId],
    );
    return (result.rowCount ?? 0) > 0;
  }
  if (action === "source_limited") {
    const result = await db.query(
      `UPDATE resources SET
         review_status = 'SOURCE_LIMITED',
         review_reason_codes = array_append(review_reason_codes, 'admin_source_limited'),
         embedding_content_hash = NULL,
         updated_at = now()
       WHERE id = $1::uuid AND active AND review_status = 'NEEDS_REVIEW'`,
      [resourceId],
    );
    return (result.rowCount ?? 0) > 0;
  }
  const result = await db.query(
    `UPDATE resources SET review_status = 'ARCHIVED', active = false, updated_at = now()
     WHERE id = $1::uuid AND review_status = 'NEEDS_REVIEW'`,
    [resourceId],
  );
  return (result.rowCount ?? 0) > 0;
}
