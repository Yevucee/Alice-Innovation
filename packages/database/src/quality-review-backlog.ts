import type { Queryable } from "./pool.js";
import { qualityReviewBreakdown } from "./quality-audit.js";
import { countNeedsReview } from "./needs-review-reconcile.js";

export interface QualityReviewBacklogRunRow {
  id: string;
  started_at: Date;
  completed_at: Date | null;
  trigger: string;
  needs_review_before: number;
  needs_review_after: number;
  cleared: number;
  source_limited: number;
  still_flagged: number;
  newly_flagged: number;
  net_change: number;
  reason_counts_before: Record<string, number>;
  reason_counts_after: Record<string, number>;
  sample_report: unknown;
}

export async function startQualityReviewBacklogRun(
  db: Queryable,
  trigger: string,
): Promise<{ id: string; needs_review_before: number; reason_counts_before: Record<string, number> }> {
  const needs_review_before = await countNeedsReview(db);
  const breakdown = await qualityReviewBreakdown(db);
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO quality_review_backlog_runs (
       trigger, needs_review_before, reason_counts_before
     ) VALUES ($1, $2, $3::jsonb)
     RETURNING id::text`,
    [trigger, needs_review_before, JSON.stringify(breakdown.by_reason)],
  );
  return {
    id: inserted.rows[0]?.id ?? "",
    needs_review_before,
    reason_counts_before: breakdown.by_reason,
  };
}

export async function completeQualityReviewBacklogRun(
  db: Queryable,
  input: {
    id: string;
    cleared: number;
    source_limited: number;
    still_flagged: number;
    newly_flagged: number;
    sample_report?: unknown;
  },
): Promise<void> {
  const needs_review_after = await countNeedsReview(db);
  const breakdown = await qualityReviewBreakdown(db);
  const needs_review_before = await db.query<{ n: number }>(
    `SELECT needs_review_before AS n FROM quality_review_backlog_runs WHERE id = $1::uuid`,
    [input.id],
  );
  const before = Number(needs_review_before.rows[0]?.n ?? needs_review_after);
  const net_change = needs_review_after - before;
  await db.query(
    `UPDATE quality_review_backlog_runs SET
       completed_at = now(),
       needs_review_after = $2,
       cleared = $3,
       source_limited = $4,
       still_flagged = $5,
       newly_flagged = $6,
       net_change = $7,
       reason_counts_after = $8::jsonb,
       sample_report = $9::jsonb
     WHERE id = $1::uuid`,
    [
      input.id,
      needs_review_after,
      input.cleared,
      input.source_limited,
      input.still_flagged,
      input.newly_flagged,
      net_change,
      JSON.stringify(breakdown.by_reason),
      JSON.stringify(input.sample_report ?? null),
    ],
  );
}

export async function latestQualityReviewBacklogRun(
  db: Queryable,
): Promise<QualityReviewBacklogRunRow | null> {
  const rows = await db.query<QualityReviewBacklogRunRow>(
    `SELECT id::text, started_at, completed_at, trigger,
            needs_review_before, needs_review_after,
            cleared, source_limited, still_flagged, newly_flagged, net_change,
            reason_counts_before, reason_counts_after, sample_report
     FROM quality_review_backlog_runs
     WHERE completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 1`,
  );
  return rows.rows[0] ?? null;
}

export async function sampleNeedsReviewBySources(
  db: Queryable,
  sourceSlugs: string[],
  limitPerSource: number,
): Promise<Record<string, Array<Record<string, unknown>>>> {
  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const slug of sourceSlugs) {
    const rows = await db.query(
      `SELECT r.id::text AS resource_id,
              r.canonical_title AS title,
              r.review_status,
              r.review_reason_codes,
              r.source_summary,
              length(r.extracted_index_text) AS body_len
       FROM resources r
       JOIN resource_source_links rsl ON rsl.resource_id = r.id
       JOIN source_items si ON si.id = rsl.source_item_id
       JOIN sources s ON s.id = si.source_id
       WHERE r.active AND s.slug = $1
         AND r.review_status IN ('NEEDS_REVIEW', 'SOURCE_LIMITED', 'AUTO_INGESTED')
       ORDER BY r.updated_at DESC
       LIMIT $2`,
      [slug, limitPerSource],
    );
    out[slug] = rows.rows as Array<Record<string, unknown>>;
  }
  return out;
}
