import type { Queryable } from "./pool.js";
import { auditDraftShape } from "./quality-audit.js";

const BATCH = 80;

const SOURCE_LIMITED_REASONS = new Set([
  "short_description",
  "listing_only_thin",
  "truncated_title",
  "blocklist_title",
  "cohort_boilerplate_title",
  "cohort_title_equals_summary",
]);

export interface NeedsReviewReconcileRow {
  id: string;
  title: string;
  source_summary: string;
  extracted_index_text: string;
  organisation_name: string | null;
  person_name: string | null;
  raw_metadata: Record<string, unknown>;
  source_slug: string | null;
  canonical_url: string | null;
}

export interface NeedsReviewReconcileBatchResult {
  scanned: number;
  cleared: number;
  source_limited: number;
  still_flagged: number;
  offset: number;
  next_offset: number;
  complete: boolean;
  reembed_resource_ids: string[];
}

function uniqueBodyLength(summary: string, body: string): number {
  const s = summary.trim();
  const b = body.trim();
  if (b && b !== s) return Math.max(s.length, b.length);
  return s.length;
}

export function shouldAcceptSourceLimited(reasons: string[], row: NeedsReviewReconcileRow): boolean {
  if (reasons.length === 0) return false;
  const thin = uniqueBodyLength(row.source_summary, row.extracted_index_text) < 80;
  const onlyThinReasons = reasons.every(
    (code) => SOURCE_LIMITED_REASONS.has(code) || (code === "invalid_org_name" && thin),
  );
  if (!onlyThinReasons) return false;
  if (reasons.some((code) => SOURCE_LIMITED_REASONS.has(code)) && thin) return true;
  if (reasons.includes("blocklist_title") || reasons.includes("cohort_boilerplate_title")) return true;
  if (reasons.includes("invalid_org_name") && !row.organisation_name?.trim() && thin) return true;
  return false;
}

export function evaluateResourceQuality(row: NeedsReviewReconcileRow): string[] {
  return auditDraftShape({
    title: row.title,
    sourceSummary: row.source_summary,
    extractedText: row.extracted_index_text,
    organisationName: row.organisation_name,
    personName: row.person_name,
    rawMetadata: row.raw_metadata ?? {},
  });
}

export async function loadNeedsReviewReconcileBatch(
  db: Queryable,
  offset: number,
): Promise<NeedsReviewReconcileRow[]> {
  const rows = await db.query<NeedsReviewReconcileRow>(
    `SELECT r.id::text,
            r.canonical_title AS title,
            r.source_summary,
            r.extracted_index_text,
            (
              SELECT o.name FROM resource_organisations ro
              JOIN organisations o ON o.id = ro.organisation_id
              WHERE ro.resource_id = r.id AND ro.is_primary IS TRUE
              LIMIT 1
            ) AS organisation_name,
            (
              SELECT p.name FROM resource_people rp
              JOIN people p ON p.id = rp.person_id
              WHERE rp.resource_id = r.id
              ORDER BY p.name
              LIMIT 1
            ) AS person_name,
            COALESCE((
              SELECT si.raw_metadata_json FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.updated_at DESC NULLS LAST
              LIMIT 1
            ), '{}'::jsonb) AS raw_metadata,
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
            ) AS canonical_url
     FROM resources r
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW'
     ORDER BY r.id
     OFFSET $1 LIMIT $2`,
    [offset, BATCH],
  );
  return rows.rows;
}

export async function runNeedsReviewReconcileBatch(
  db: Queryable,
  offset: number,
): Promise<NeedsReviewReconcileBatchResult> {
  const rows = await loadNeedsReviewReconcileBatch(db, offset);
  let cleared = 0;
  let source_limited = 0;
  let still_flagged = 0;
  const reembed_resource_ids: string[] = [];

  for (const row of rows) {
    const finalReasons = evaluateResourceQuality(row);
    if (finalReasons.length === 0) {
      await db.query(
        `UPDATE resources SET
           review_status = 'AUTO_INGESTED',
           review_reason_codes = '{}'::text[],
           quality_audit_verified_at = now(),
           embedding_content_hash = NULL,
           updated_at = now()
         WHERE id = $1::uuid`,
        [row.id],
      );
      cleared += 1;
      reembed_resource_ids.push(row.id);
      continue;
    }

    if (shouldAcceptSourceLimited(finalReasons, row)) {
      await db.query(
        `UPDATE resources SET
           review_status = 'SOURCE_LIMITED',
           review_reason_codes = $2::text[],
           embedding_content_hash = NULL,
           updated_at = now()
         WHERE id = $1::uuid`,
        [row.id, ["source_limited_accepted", ...finalReasons]],
      );
      source_limited += 1;
      reembed_resource_ids.push(row.id);
      continue;
    }

    await db.query(
      `UPDATE resources SET review_reason_codes = $2::text[], updated_at = now() WHERE id = $1::uuid`,
      [row.id, finalReasons],
    );
    still_flagged += 1;
  }

  return {
    scanned: rows.length,
    cleared,
    source_limited,
    still_flagged,
    offset,
    next_offset: offset + rows.length,
    complete: rows.length < BATCH,
    reembed_resource_ids,
  };
}

export async function countNeedsReview(db: Queryable): Promise<number> {
  const row = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM resources WHERE active AND review_status = 'NEEDS_REVIEW'`,
  );
  return Number(row.rows[0]?.count ?? 0);
}
