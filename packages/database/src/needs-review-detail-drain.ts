import type { Queryable } from "./pool.js";
import { auditDraftShape } from "./quality-audit.js";
import { shouldAcceptSourceLimited } from "./needs-review-reconcile.js";
import {
  classifyBulkFixOutcome,
  type NeedsReviewBulkFixRow,
  proposeNeedsReviewBulkFix,
} from "./needs-review-bulk-fix.js";

export const NEEDS_REVIEW_DETAIL_DRAIN_JOB_KEY = "needs_review_detail_drain_202510";

/** Bump when detail-drain classification or target sources change; triggers job re-queue on deploy. */
export const DETAIL_DRAIN_ALGORITHM_VERSION = 2;

export const NEEDS_REVIEW_DETAIL_DRAIN_BATCH_SIZE = 12;

/** Production backlog sources (Oct 2025). */
export const NEEDS_REVIEW_DETAIL_DRAIN_TARGET_SOURCES = [
  "mit-solve",
  "atlas-of-the-future",
  "wipo-green",
  "solar-impulse",
  "injini-african-edtech-map",
  "startgate-um6p",
  "afrilabs",
  "hundred",
  "j-startup",
] as const;

/** Sources with no per-item detail URL — classify from listing data only (may become SOURCE_LIMITED). */
export const NEEDS_REVIEW_DETAIL_DRAIN_LISTING_ONLY_SOURCES: readonly string[] = [
  "injini-african-edtech-map",
];

export function detailDrainRequiresSuccessfulFetch(sourceSlug: string | null): boolean {
  if (!sourceSlug) return true;
  return !NEEDS_REVIEW_DETAIL_DRAIN_LISTING_ONLY_SOURCES.includes(sourceSlug);
}

export type DetailDrainSourceSlug = (typeof NEEDS_REVIEW_DETAIL_DRAIN_TARGET_SOURCES)[number];

export type NeedsReviewDetailDrainMode = "dry_run" | "apply";

export function currentNeedsReviewDetailDrainMode(): NeedsReviewDetailDrainMode {
  const raw = process.env.NEEDS_REVIEW_DETAIL_DRAIN_APPLY?.trim().toLowerCase();
  if (!raw || raw === "false" || raw === "0" || raw === "no") return "dry_run";
  return "apply";
}

export function detailDrainModeWrites(): boolean {
  return currentNeedsReviewDetailDrainMode() === "apply";
}

export const NEEDS_REVIEW_DETAIL_DRAIN_SAMPLE_LIMIT = 20;

export type DetailDrainSourceCounts = {
  repaired: number;
  cleared: number;
  source_limited: number;
  still_flagged: number;
  fetch_failed: number;
};

export interface NeedsReviewDetailDrainSample {
  resource_id: string;
  source_slug: string | null;
  canonical_url: string | null;
  action: string;
  title_before: string;
  title_after: string;
}

export interface DetailDrainDraftFields {
  title: string;
  source_summary: string;
  extracted_index_text: string;
  clear_organisation: boolean;
}

export type DetailDrainOutcome =
  | { action: "cleared"; reasons: string[]; repaired: boolean }
  | { action: "source_limited"; reasons: string[]; repaired: boolean }
  | { action: "still_flagged"; reasons: string[]; repaired: boolean }
  | { action: "unchanged"; reasons: string[]; repaired: false };

function bodyLen(summary: string, body: string): number {
  const s = summary.trim();
  const b = body.trim();
  if (b && b !== s) return Math.max(s.length, b.length);
  return s.length;
}

/** True when detail refetch (or repair) materially improved title or body vs stored row. */
export function detailRefetchImprovedRow(
  row: NeedsReviewBulkFixRow,
  fixed: DetailDrainDraftFields,
): boolean {
  const titleBefore = row.title.trim();
  const titleAfter = fixed.title.trim();
  if (titleAfter.length > titleBefore.length + 4 && titleAfter !== titleBefore) return true;
  const beforeBody = bodyLen(row.source_summary, row.extracted_index_text);
  const afterBody = bodyLen(fixed.source_summary, fixed.extracted_index_text);
  if (afterBody >= beforeBody + 40) return true;
  if (beforeBody < 80 && afterBody >= 80) return true;
  return false;
}

export function classifyDetailDrainOutcome(
  row: NeedsReviewBulkFixRow,
  fixed: DetailDrainDraftFields,
): DetailDrainOutcome {
  const repaired = detailRefetchImprovedRow(row, fixed);
  const bulkOutcome = classifyBulkFixOutcome(row, fixed);
  if (bulkOutcome.action === "hide") {
    return { action: "still_flagged", reasons: bulkOutcome.reasons, repaired };
  }
  if (bulkOutcome.action === "cleared") {
    return { action: "cleared", reasons: [], repaired };
  }
  if (bulkOutcome.action === "source_limited") {
    return { action: "source_limited", reasons: bulkOutcome.reasons, repaired };
  }
  if (bulkOutcome.action === "updated") {
    return { action: "still_flagged", reasons: bulkOutcome.reasons, repaired };
  }
  if (bulkOutcome.action === "unchanged") {
    const reasons = auditDraftShape({
      title: fixed.title,
      sourceSummary: fixed.source_summary,
      extractedText: fixed.extracted_index_text,
      organisationName: fixed.clear_organisation ? null : row.organisation_name,
      personName: row.person_name,
      rawMetadata: row.raw_metadata ?? {},
    });
    if (shouldAcceptSourceLimited(reasons, {
      ...row,
      title: fixed.title,
      source_summary: fixed.source_summary,
      extracted_index_text: fixed.extracted_index_text,
      organisation_name: fixed.clear_organisation ? null : row.organisation_name,
    })) {
      return { action: "source_limited", reasons, repaired };
    }
    return { action: "unchanged", reasons, repaired: false };
  }
  const _exhaustive: never = bulkOutcome;
  return _exhaustive;
}

export function proposeDetailDrainFields(
  row: NeedsReviewBulkFixRow,
  enriched: { title: string; sourceSummary: string; extractedText: string },
): DetailDrainDraftFields {
  return proposeNeedsReviewBulkFix({
    ...row,
    title: enriched.title,
    source_summary: enriched.sourceSummary,
    extracted_index_text: enriched.extractedText,
  });
}

export function initialNeedsReviewDetailDrainProgress(
  mode: NeedsReviewDetailDrainMode,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    mode,
    algorithm_version: DETAIL_DRAIN_ALGORITHM_VERSION,
    last_id: null,
    totals: {
      repaired: 0,
      cleared: 0,
      source_limited: 0,
      still_flagged: 0,
      scanned: 0,
      fetch_failed: 0,
    },
    by_source: {},
    title_samples: [],
    pending_reembed_ids: [],
    complete: false,
    ...extra,
  };
}

export function readDetailDrainAlgorithmVersion(source: Record<string, unknown> | null | undefined): number {
  if (typeof source?.algorithm_version === "number") return source.algorithm_version;
  return 1;
}

export function prepareNeedsReviewDetailDrainProgress(
  progress: Record<string, unknown>,
  mode: NeedsReviewDetailDrainMode,
): { progress: Record<string, unknown>; modeReset: boolean; previousMode: string | null } {
  const stored = typeof progress.mode === "string" ? progress.mode : null;
  const storedVersion = readDetailDrainAlgorithmVersion(progress);
  const versionMismatch = storedVersion !== DETAIL_DRAIN_ALGORITHM_VERSION;
  if (stored === mode && !versionMismatch) {
    return { progress, modeReset: false, previousMode: null };
  }
  const previousMode = stored;
  return {
    progress: initialNeedsReviewDetailDrainProgress(mode, {
      ...(stored !== mode && previousMode
        ? { mode_reset_from: previousMode, mode_reset_at: new Date().toISOString() }
        : {}),
      ...(versionMismatch
        ? {
            algorithm_version_reset_from: storedVersion,
            algorithm_version_reset_at: new Date().toISOString(),
          }
        : {}),
    }),
    modeReset: Boolean(previousMode && stored !== mode) || versionMismatch,
    previousMode: stored !== mode ? previousMode : null,
  };
}

export function formatNeedsReviewDetailDrainSummary(input: {
  mode: NeedsReviewDetailDrainMode;
  totals: Record<string, number>;
  by_source: Record<string, DetailDrainSourceCounts>;
  samples: NeedsReviewDetailDrainSample[];
  mode_reset_from?: string | null;
  algorithm_version?: number;
  algorithm_version_reset_from?: number | null;
}): string {
  const t = input.totals;
  const algoVersion = input.algorithm_version ?? DETAIL_DRAIN_ALGORITHM_VERSION;
  const lines = [
    `NEEDS_REVIEW detail drain | algorithm_version=${algoVersion} | run_mode=${input.mode}${input.mode_reset_from ? ` | restarted_from=${input.mode_reset_from}` : ""}${input.algorithm_version_reset_from != null ? ` | algo_restarted_from=${input.algorithm_version_reset_from}` : ""}`,
    `totals: repaired=${t.repaired ?? 0} cleared=${t.cleared ?? 0} source_limited=${t.source_limited ?? 0} still_flagged=${t.still_flagged ?? 0} scanned=${t.scanned ?? 0} fetch_failed=${t.fetch_failed ?? 0}`,
    `by_source: ${JSON.stringify(input.by_source)}`,
  ];
  if (input.samples.length > 0) {
    lines.push("title_samples (up to 20 per source in aggregate):");
    for (const sample of input.samples) {
      lines.push(
        `  [${sample.action}] ${sample.source_slug ?? "?"} | ${sample.canonical_url ?? "—"} | "${sample.title_before}" → "${sample.title_after}"`,
      );
    }
  }
  return lines.join("\n");
}

export async function loadNeedsReviewDetailDrainBatch(
  db: Queryable,
  afterId: string | null,
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
              SELECT si.external_id FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC NULLS LAST
              LIMIT 1
            ) AS source_external_id,
            (
              SELECT si.canonical_url FROM resource_source_links l
              JOIN source_items si ON si.id = l.source_item_id
              WHERE l.resource_id = r.id
              ORDER BY si.last_seen_at DESC NULLS LAST
              LIMIT 1
            ) AS canonical_url
     FROM resources r
     WHERE r.active AND r.review_status = 'NEEDS_REVIEW'
       AND ($1::uuid IS NULL OR r.id > $1::uuid)
       AND EXISTS (
         SELECT 1 FROM resource_source_links l
         JOIN source_items si ON si.id = l.source_item_id
         JOIN sources s ON s.id = si.source_id
         WHERE l.resource_id = r.id AND s.slug = ANY($3::text[])
       )
     ORDER BY r.id
     LIMIT $2`,
    [afterId, NEEDS_REVIEW_DETAIL_DRAIN_BATCH_SIZE, [...NEEDS_REVIEW_DETAIL_DRAIN_TARGET_SOURCES]],
  );
  return rows.rows;
}

export interface NeedsReviewDetailDrainBatchResult {
  scanned: number;
  repaired: number;
  cleared: number;
  source_limited: number;
  still_flagged: number;
  fetch_failed: number;
  last_id: string | null;
  next_last_id: string | null;
  complete: boolean;
  reembed_resource_ids: string[];
  by_source: Record<string, DetailDrainSourceCounts>;
  samples: NeedsReviewDetailDrainSample[];
}

export async function applyDetailDrainOutcome(
  db: Queryable,
  row: NeedsReviewBulkFixRow,
  fixed: DetailDrainDraftFields,
  outcome: DetailDrainOutcome,
): Promise<void> {
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
    return;
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
  }
}

export async function requeueNeedsReviewDetailDrainJobIfModeChanged(
  db: Queryable,
): Promise<{
  requeued: boolean;
  previous_mode: string | null;
  current_mode: NeedsReviewDetailDrainMode;
  previous_algorithm_version: number;
  current_algorithm_version: number;
}> {
  const current_mode = currentNeedsReviewDetailDrainMode();
  const current_algorithm_version = DETAIL_DRAIN_ALGORITHM_VERSION;
  const row = await db.query<{
    status: string;
    progress: Record<string, unknown>;
    result: Record<string, unknown> | null;
  }>(
    `SELECT status, progress, result FROM post_deploy_jobs WHERE job_key = $1`,
    [NEEDS_REVIEW_DETAIL_DRAIN_JOB_KEY],
  );
  const job = row.rows[0];
  if (!job) {
    return {
      requeued: false,
      previous_mode: null,
      current_mode,
      previous_algorithm_version: 1,
      current_algorithm_version,
    };
  }
  const stored =
    (typeof job.result?.mode === "string" ? job.result.mode : null)
    ?? (typeof job.progress?.mode === "string" ? job.progress.mode : null);
  const previous_algorithm_version = Math.max(
    readDetailDrainAlgorithmVersion(job.progress),
    readDetailDrainAlgorithmVersion(job.result ?? undefined),
  );
  const modeMismatch = Boolean(stored && stored !== current_mode);
  const versionMismatch = previous_algorithm_version !== current_algorithm_version;
  if (!modeMismatch && !versionMismatch) {
    return {
      requeued: false,
      previous_mode: stored,
      current_mode,
      previous_algorithm_version,
      current_algorithm_version,
    };
  }
  const fresh = initialNeedsReviewDetailDrainProgress(current_mode, {
    ...(modeMismatch && stored
      ? { mode_reset_from: stored, mode_reset_at: new Date().toISOString() }
      : {}),
    ...(versionMismatch
      ? {
          algorithm_version_reset_from: previous_algorithm_version,
          algorithm_version_reset_at: new Date().toISOString(),
        }
      : {}),
  });
  await db.query(
    `UPDATE post_deploy_jobs
     SET status = 'pending',
         progress = $2::jsonb,
         result = NULL,
         last_error = NULL,
         updated_at = now()
     WHERE job_key = $1`,
    [NEEDS_REVIEW_DETAIL_DRAIN_JOB_KEY, JSON.stringify(fresh)],
  );
  return {
    requeued: true,
    previous_mode: stored,
    current_mode,
    previous_algorithm_version,
    current_algorithm_version,
  };
}
