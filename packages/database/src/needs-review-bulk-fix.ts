import {
  convertAllCapsTitleToTitleCase,
  looksLikeAllCapsTitle,
  mergeColonSplitTitle,
  repairSourceSummary,
  truncateAtWordBoundary,
} from "@alice/shared";
import type { Queryable } from "./pool.js";
import { auditDraftShape } from "./quality-audit.js";
import { shouldAcceptSourceLimited } from "./needs-review-reconcile.js";

const BATCH = 100;

export interface NeedsReviewBulkFixRow {
  id: string;
  title: string;
  source_summary: string;
  extracted_index_text: string;
  organisation_name: string | null;
  person_name: string | null;
  raw_metadata: Record<string, unknown>;
  source_slug: string | null;
  source_item_title: string | null;
  canonical_url: string | null;
}

export type BulkFixAction =
  | { action: "cleared"; reasons: string[] }
  | { action: "source_limited"; reasons: string[] }
  | { action: "updated"; reasons: string[] }
  | { action: "unchanged"; reasons: string[] };

export function proposeNeedsReviewBulkFix(row: NeedsReviewBulkFixRow): {
  title: string;
  source_summary: string;
  extracted_index_text: string;
  clear_organisation: boolean;
} {
  let title = row.title;
  let summary = row.source_summary;
  let body = row.extracted_index_text;
  let clearOrg = false;

  if (looksLikeAllCapsTitle(title)) {
    title = convertAllCapsTitleToTitleCase(title);
  }

  const colon = mergeColonSplitTitle(title, summary);
  title = colon.title;
  summary = colon.summary;

  if (row.source_item_title && row.source_item_title.trim().length > title.trim().length + 4) {
    title = row.source_item_title.trim();
  }

  summary = repairSourceSummary({
    title,
    summary,
    bodyText: body,
    metaDescription:
      typeof row.raw_metadata?.meta_description === "string" ? row.raw_metadata.meta_description : null,
  });

  if (summary.trim().length < 80 && body.trim().length >= 80) {
    summary = truncateAtWordBoundary(body, 500);
  }

  if (
    row.organisation_name
    && auditDraftShape({
      title,
      sourceSummary: summary,
      extractedText: body,
      organisationName: row.organisation_name,
      personName: row.person_name,
      rawMetadata: row.raw_metadata ?? {},
    }).includes("invalid_org_name")
  ) {
    clearOrg = true;
  }

  if (
    row.organisation_name
    && /for-profit|non-profit|legal form|b-corp|sole proprietorship/i.test(row.organisation_name)
  ) {
    clearOrg = true;
  }

  return {
    title: truncateAtWordBoundary(title, 300),
    source_summary: truncateAtWordBoundary(summary, 500),
    extracted_index_text: body,
    clear_organisation: clearOrg,
  };
}

export function classifyBulkFixOutcome(
  row: NeedsReviewBulkFixRow,
  fixed: ReturnType<typeof proposeNeedsReviewBulkFix>,
): BulkFixAction {
  const reasons = auditDraftShape({
    title: fixed.title,
    sourceSummary: fixed.source_summary,
    extractedText: fixed.extracted_index_text,
    organisationName: fixed.clear_organisation ? null : row.organisation_name,
    personName: row.person_name,
    rawMetadata: row.raw_metadata ?? {},
  });

  if (reasons.length === 0) {
    return { action: "cleared", reasons: [] };
  }

  const reconcileRow = {
    ...row,
    title: fixed.title,
    source_summary: fixed.source_summary,
    extracted_index_text: fixed.extracted_index_text,
    organisation_name: fixed.clear_organisation ? null : row.organisation_name,
  };

  if (shouldAcceptSourceLimited(reasons, reconcileRow)) {
    return { action: "source_limited", reasons };
  }

  if (
    fixed.title === row.title
    && fixed.source_summary === row.source_summary
    && !fixed.clear_organisation
  ) {
    return { action: "unchanged", reasons };
  }

  return { action: "updated", reasons };
}

export async function loadNeedsReviewBulkFixBatch(
  db: Queryable,
  offset: number,
  sourceSlug?: string | null,
): Promise<NeedsReviewBulkFixRow[]> {
  const rows = await db.query<NeedsReviewBulkFixRow>(
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
              SELECT si.title FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC NULLS LAST
              LIMIT 1
            ) AS source_item_title,
            (
              SELECT si.canonical_url FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC NULLS LAST
              LIMIT 1
            ) AS canonical_url
     FROM resources r
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW'
       AND ($3::text IS NULL OR EXISTS (
         SELECT 1 FROM resource_source_links l
         JOIN source_items si ON si.id = l.source_item_id
         JOIN sources s ON s.id = si.source_id
         WHERE l.resource_id = r.id AND s.slug = $3
       ))
     ORDER BY r.id
     OFFSET $1 LIMIT $2`,
    [offset, BATCH, sourceSlug ?? null],
  );
  return rows.rows;
}

export interface NeedsReviewBulkFixBatchResult {
  scanned: number;
  cleared: number;
  source_limited: number;
  updated: number;
  unchanged: number;
  still_flagged: number;
  offset: number;
  next_offset: number;
  complete: boolean;
  reembed_resource_ids: string[];
  by_source: Record<string, { cleared: number; source_limited: number; updated: number; still_flagged: number }>;
}

export async function runNeedsReviewBulkFixBatch(
  db: Queryable,
  offset: number,
  input?: { dryRun?: boolean; sourceSlug?: string | null },
): Promise<NeedsReviewBulkFixBatchResult> {
  const rows = await loadNeedsReviewBulkFixBatch(db, offset, input?.sourceSlug ?? null);
  let cleared = 0;
  let source_limited = 0;
  let updated = 0;
  let unchanged = 0;
  let still_flagged = 0;
  const reembed_resource_ids: string[] = [];
  const by_source: NeedsReviewBulkFixBatchResult["by_source"] = {};

  const bump = (slug: string, field: keyof NeedsReviewBulkFixBatchResult["by_source"][string]) => {
    const key = slug || "unknown";
    if (!by_source[key]) {
      by_source[key] = { cleared: 0, source_limited: 0, updated: 0, still_flagged: 0 };
    }
    by_source[key][field] += 1;
  };

  for (const row of rows) {
    const fixed = proposeNeedsReviewBulkFix(row);
    const outcome = classifyBulkFixOutcome(row, fixed);
    const slug = row.source_slug ?? "unknown";

    if (outcome.action === "unchanged") {
      unchanged += 1;
      if (outcome.reasons.length > 0) {
        still_flagged += 1;
        bump(slug, "still_flagged");
      }
      continue;
    }

    if (input?.dryRun) {
      if (outcome.action === "cleared") {
        cleared += 1;
        bump(slug, "cleared");
      } else if (outcome.action === "source_limited") {
        source_limited += 1;
        bump(slug, "source_limited");
      } else if (outcome.action === "updated") {
        updated += 1;
        if (outcome.reasons.length > 0) {
          still_flagged += 1;
          bump(slug, "still_flagged");
        }
      }
      continue;
    }

    if (outcome.action === "cleared") {
      await db.query(
        `UPDATE resources SET
           canonical_title = $2,
           source_summary = $3,
           extracted_index_text = $4,
           review_status = 'AUTO_INGESTED',
           review_reason_codes = '{}'::text[],
           quality_audit_verified_at = now(),
           embedding_content_hash = NULL,
           updated_at = now()
         WHERE id = $1::uuid`,
        [row.id, fixed.title, fixed.source_summary, fixed.extracted_index_text],
      );
      if (fixed.clear_organisation) {
        await db.query(`DELETE FROM resource_organisations WHERE resource_id = $1::uuid`, [row.id]);
      }
      cleared += 1;
      bump(slug, "cleared");
      reembed_resource_ids.push(row.id);
      continue;
    }

    if (outcome.action === "source_limited") {
      await db.query(
        `UPDATE resources SET
           canonical_title = $2,
           source_summary = $3,
           extracted_index_text = $4,
           review_status = 'SOURCE_LIMITED',
           review_reason_codes = $5::text[],
           embedding_content_hash = NULL,
           updated_at = now()
         WHERE id = $1::uuid`,
        [row.id, fixed.title, fixed.source_summary, fixed.extracted_index_text, ["source_limited_accepted", ...outcome.reasons]],
      );
      if (fixed.clear_organisation) {
        await db.query(`DELETE FROM resource_organisations WHERE resource_id = $1::uuid`, [row.id]);
      }
      source_limited += 1;
      bump(slug, "source_limited");
      reembed_resource_ids.push(row.id);
      continue;
    }

    await db.query(
      `UPDATE resources SET
         canonical_title = $2,
         source_summary = $3,
         extracted_index_text = $4,
         review_reason_codes = $5::text[],
         updated_at = now()
       WHERE id = $1::uuid`,
      [row.id, fixed.title, fixed.source_summary, fixed.extracted_index_text, outcome.reasons],
    );
    if (fixed.clear_organisation) {
      await db.query(`DELETE FROM resource_organisations WHERE resource_id = $1::uuid`, [row.id]);
    }
    updated += 1;
    if (outcome.reasons.length > 0) {
      still_flagged += 1;
      bump(slug, "still_flagged");
    }
  }

  return {
    scanned: rows.length,
    cleared,
    source_limited,
    updated,
    unchanged,
    still_flagged,
    offset,
    next_offset: offset + rows.length,
    complete: rows.length < BATCH,
    reembed_resource_ids,
    by_source,
  };
}
