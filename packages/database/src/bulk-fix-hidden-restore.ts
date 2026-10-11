import type { Queryable } from "./pool.js";
import { BULK_FIX_JUNK_REASON_CODES } from "./needs-review-bulk-fix-junk.js";

export interface BulkFixHiddenRow {
  id: string;
  canonical_title: string;
  review_reason_codes: string[];
  updated_at: Date;
}

export async function countBulkFixHiddenResources(db: Queryable): Promise<number> {
  const row = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM resources
     WHERE active = false
       AND review_status = 'ARCHIVED'
       AND review_reason_codes && $1::text[]`,
    [BULK_FIX_JUNK_REASON_CODES],
  );
  return Number(row.rows[0]?.count ?? 0);
}

export async function restoreBulkFixHiddenResource(db: Queryable, resourceId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE resources SET
       active = true,
       review_status = 'NEEDS_REVIEW',
       updated_at = now()
     WHERE id = $1::uuid
       AND active = false
       AND review_status = 'ARCHIVED'
       AND review_reason_codes && $2::text[]`,
    [resourceId, BULK_FIX_JUNK_REASON_CODES],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function restoreBulkFixHiddenBatch(
  db: Queryable,
  input?: { limit?: number },
): Promise<{ restored: number }> {
  const limit = Math.min(Math.max(input?.limit ?? 500, 1), 5000);
  const result = await db.query<{ id: string }>(
    `WITH picked AS (
       SELECT id FROM resources
       WHERE active = false
         AND review_status = 'ARCHIVED'
         AND review_reason_codes && $2::text[]
       ORDER BY updated_at DESC
       LIMIT $1
     )
     UPDATE resources r SET
       active = true,
       review_status = 'NEEDS_REVIEW',
       updated_at = now()
     FROM picked
     WHERE r.id = picked.id
     RETURNING r.id::text AS id`,
    [limit, BULK_FIX_JUNK_REASON_CODES],
  );
  return { restored: result.rowCount ?? 0 };
}
