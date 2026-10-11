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
import {
  type BulkFixDuplicateTracker,
  detectBulkFixJunk,
  JUNK_DUPLICATE_TITLE_CONTENT,
  JUNK_GENERIC_TITLE,
} from "./needs-review-bulk-fix-junk.js";
import { repairBulkFixTitle } from "./needs-review-bulk-fix-title-repair.js";

export const NEEDS_REVIEW_BULK_FIX_BATCH_SIZE = 100;

const BATCH = NEEDS_REVIEW_BULK_FIX_BATCH_SIZE;

export type NeedsReviewBulkFixMode = "dry_run" | "apply_cleared_only" | "apply_all";

/** @deprecated use currentNeedsReviewBulkFixMode() */
export function needsReviewBulkFixApplyEnabled(): boolean {
  return currentNeedsReviewBulkFixMode() !== "dry_run";
}

export function currentNeedsReviewBulkFixMode(): NeedsReviewBulkFixMode {
  const raw = process.env.NEEDS_REVIEW_BULK_FIX_APPLY?.trim().toLowerCase();
  if (!raw || raw === "false" || raw === "0" || raw === "no") return "dry_run";
  if (raw === "cleared-only" || raw === "cleared_only" || raw === "cleared") return "apply_cleared_only";
  return "apply_all";
}

export function bulkFixModeWritesOutcome(
  mode: NeedsReviewBulkFixMode,
  action: "cleared" | "source_limited" | "hide" | "updated",
): boolean {
  if (mode === "dry_run") return false;
  if (mode === "apply_cleared_only") return action === "cleared";
  return true;
}

export function initialNeedsReviewBulkFixProgress(
  mode: NeedsReviewBulkFixMode,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    mode,
    last_id: null,
    totals: {
      cleared: 0,
      source_limited: 0,
      hide: 0,
      updated: 0,
      still_flagged: 0,
      scanned: 0,
      unchanged: 0,
    },
    by_source: {},
    title_samples: [],
    hide_samples: [],
    duplicate_tracker: {},
    pending_reembed_ids: [],
    complete: false,
    ...extra,
  };
}

/** Reset paging when switching dry_run ↔ apply so apply revisits every row. */
export function prepareNeedsReviewBulkFixProgress(
  progress: Record<string, unknown>,
  mode: NeedsReviewBulkFixMode,
): { progress: Record<string, unknown>; modeReset: boolean; previousMode: string | null } {
  const stored = typeof progress.mode === "string" ? progress.mode : null;
  if (stored === mode) {
    return { progress, modeReset: false, previousMode: null };
  }
  const previousMode = stored;
  return {
    progress: initialNeedsReviewBulkFixProgress(mode, {
      mode_reset_from: previousMode,
      mode_reset_at: new Date().toISOString(),
    }),
    modeReset: Boolean(previousMode),
    previousMode,
  };
}

export const NEEDS_REVIEW_BULK_FIX_SAMPLE_LIMIT = 20;
export const NEEDS_REVIEW_BULK_FIX_HIDE_SAMPLE_LIMIT = 100;

export interface NeedsReviewBulkFixSample {
  resource_id: string;
  source_slug: string | null;
  canonical_url: string | null;
  action: string;
  title_before: string;
  title_after: string;
}

export function formatNeedsReviewBulkFixSummary(input: {
  mode: NeedsReviewBulkFixMode;
  totals: Record<string, number>;
  by_source: NeedsReviewBulkFixBatchResult["by_source"];
  samples: NeedsReviewBulkFixSample[];
  hide_samples?: NeedsReviewBulkFixSample[];
  mode_reset_from?: string | null;
}): string {
  const t = input.totals;
  const lines = [
    `NEEDS_REVIEW bulk fix | run_mode=${input.mode}${input.mode_reset_from ? ` | restarted_from=${input.mode_reset_from}` : ""}`,
    `totals: cleared=${t.cleared ?? 0} source_limited=${t.source_limited ?? 0} hide=${t.hide ?? 0} updated=${t.updated ?? 0} still_flagged=${t.still_flagged ?? 0} scanned=${t.scanned ?? 0}`,
    `by_source: ${JSON.stringify(input.by_source)}`,
  ];
  if (input.samples.length > 0) {
    lines.push("title_samples:");
    for (const sample of input.samples) {
      lines.push(
        `  [${sample.action}] ${sample.source_slug ?? "?"} | ${sample.canonical_url ?? "—"} | "${sample.title_before}" → "${sample.title_after}"`,
      );
    }
  }
  const hideSamples = input.hide_samples ?? [];
  if (hideSamples.length > 0) {
    lines.push("hide_samples:");
    for (const sample of hideSamples) {
      lines.push(
        `  [hide] ${sample.source_slug ?? "?"} | ${sample.canonical_url ?? "—"} | "${sample.title_before}" → "${sample.title_after}"`,
      );
    }
  }
  return lines.join("\n");
}

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
  | { action: "hide"; reasons: string[] }
  | { action: "updated"; reasons: string[] }
  | { action: "unchanged"; reasons: string[] };

export function proposeNeedsReviewBulkFix(row: NeedsReviewBulkFixRow): {
  title: string;
  source_summary: string;
  extracted_index_text: string;
  clear_organisation: boolean;
} {
  let title = repairBulkFixTitle(row, row.title);
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
  junkCode?: string | null,
): BulkFixAction {
  if (junkCode) {
    const code = junkCode === JUNK_DUPLICATE_TITLE_CONTENT ? junkCode : JUNK_GENERIC_TITLE;
    return { action: "hide", reasons: [code] };
  }

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
  afterId: string | null,
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
       AND ($1::uuid IS NULL OR r.id > $1::uuid)
       AND ($3::text IS NULL OR EXISTS (
         SELECT 1 FROM resource_source_links l
         JOIN source_items si ON si.id = l.source_item_id
         JOIN sources s ON s.id = si.source_id
         WHERE l.resource_id = r.id AND s.slug = $3
       ))
     ORDER BY r.id
     LIMIT $2`,
    [afterId, BATCH, sourceSlug ?? null],
  );
  return rows.rows;
}

export type NeedsReviewBulkFixSourceCounts = {
  cleared: number;
  source_limited: number;
  hide: number;
  updated: number;
  still_flagged: number;
};

export interface NeedsReviewBulkFixBatchResult {
  scanned: number;
  cleared: number;
  source_limited: number;
  hide: number;
  updated: number;
  unchanged: number;
  still_flagged: number;
  last_id: string | null;
  next_last_id: string | null;
  complete: boolean;
  reembed_resource_ids: string[];
  by_source: Record<string, NeedsReviewBulkFixSourceCounts>;
  samples: NeedsReviewBulkFixSample[];
  hide_samples: NeedsReviewBulkFixSample[];
  duplicate_tracker: BulkFixDuplicateTracker;
}

export async function hideNeedsReviewResource(
  db: Queryable,
  resourceId: string,
  reasonCodes: string[],
): Promise<void> {
  await db.query(
    `UPDATE resources SET
       review_status = 'ARCHIVED',
       active = false,
       review_reason_codes = (
         SELECT coalesce(array_agg(DISTINCT code), '{}'::text[])
         FROM unnest(array_cat(COALESCE(review_reason_codes, '{}'::text[]), $2::text[])) AS code
       ),
       embedding_content_hash = NULL,
       updated_at = now()
     WHERE id = $1::uuid`,
    [resourceId, reasonCodes],
  );
}

export async function runNeedsReviewBulkFixBatch(
  db: Queryable,
  afterId: string | null,
  input?: {
    mode?: NeedsReviewBulkFixMode;
    dryRun?: boolean;
    sourceSlug?: string | null;
    maxSamples?: number;
    existingSampleCount?: number;
    maxHideSamples?: number;
    existingHideSampleCount?: number;
    duplicateTracker?: BulkFixDuplicateTracker;
  },
): Promise<NeedsReviewBulkFixBatchResult> {
  const mode =
    input?.mode
    ?? (input?.dryRun === false ? "apply_all" : "dry_run");
  const dryRun = mode === "dry_run";
  const rows = await loadNeedsReviewBulkFixBatch(db, afterId, input?.sourceSlug ?? null);
  let cleared = 0;
  let source_limited = 0;
  let hide = 0;
  let updated = 0;
  let unchanged = 0;
  let still_flagged = 0;
  const reembed_resource_ids: string[] = [];
  const by_source: NeedsReviewBulkFixBatchResult["by_source"] = {};
  const samples: NeedsReviewBulkFixSample[] = [];
  const hide_samples: NeedsReviewBulkFixSample[] = [];
  const duplicate_tracker: BulkFixDuplicateTracker = { ...(input?.duplicateTracker ?? {}) };
  const sampleBudget = Math.max(0, (input?.maxSamples ?? 0) - (input?.existingSampleCount ?? 0));
  const hideSampleBudget = Math.max(
    0,
    (input?.maxHideSamples ?? NEEDS_REVIEW_BULK_FIX_HIDE_SAMPLE_LIMIT)
      - (input?.existingHideSampleCount ?? 0),
  );

  const maybeSample = (row: NeedsReviewBulkFixRow, fixed: ReturnType<typeof proposeNeedsReviewBulkFix>, action: string) => {
    if (samples.length >= sampleBudget) return;
    if (fixed.title === row.title && action === "unchanged") return;
    samples.push({
      resource_id: row.id,
      source_slug: row.source_slug,
      canonical_url: row.canonical_url,
      action,
      title_before: row.title,
      title_after: fixed.title,
    });
  };

  const maybeHideSample = (row: NeedsReviewBulkFixRow, fixed: ReturnType<typeof proposeNeedsReviewBulkFix>, reason: string) => {
    if (hide_samples.length >= hideSampleBudget) return;
    hide_samples.push({
      resource_id: row.id,
      source_slug: row.source_slug,
      canonical_url: row.canonical_url,
      action: reason,
      title_before: row.title,
      title_after: fixed.title,
    });
  };

  const bump = (slug: string, field: keyof NeedsReviewBulkFixSourceCounts) => {
    const key = slug || "unknown";
    if (!by_source[key]) {
      by_source[key] = { cleared: 0, source_limited: 0, hide: 0, updated: 0, still_flagged: 0 };
    }
    by_source[key][field] += 1;
  };

  for (const row of rows) {
    const fixed = proposeNeedsReviewBulkFix(row);
    const junkCode = detectBulkFixJunk(row, fixed.title, duplicate_tracker);
    const outcome = classifyBulkFixOutcome(row, fixed, junkCode);
    const slug = row.source_slug ?? "unknown";

    if (outcome.action === "unchanged") {
      unchanged += 1;
      if (outcome.reasons.length > 0) {
        still_flagged += 1;
        bump(slug, "still_flagged");
      }
      continue;
    }

    if (outcome.action === "hide") {
      hide += 1;
      bump(slug, "hide");
      maybeHideSample(row, fixed, outcome.reasons[0] ?? JUNK_GENERIC_TITLE);
      if (bulkFixModeWritesOutcome(mode, "hide")) {
        await hideNeedsReviewResource(db, row.id, outcome.reasons);
      }
      continue;
    }

    if (dryRun) {
      if (outcome.action === "cleared") {
        cleared += 1;
        bump(slug, "cleared");
        maybeSample(row, fixed, "cleared");
      } else if (outcome.action === "source_limited") {
        source_limited += 1;
        bump(slug, "source_limited");
        maybeSample(row, fixed, "source_limited");
      } else if (outcome.action === "updated") {
        updated += 1;
        maybeSample(row, fixed, "updated");
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

    if (outcome.action === "source_limited" && bulkFixModeWritesOutcome(mode, "source_limited")) {
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

    if (outcome.action === "source_limited" && !bulkFixModeWritesOutcome(mode, "source_limited")) {
      source_limited += 1;
      bump(slug, "source_limited");
      maybeSample(row, fixed, "source_limited");
      continue;
    }

    if (!bulkFixModeWritesOutcome(mode, "updated")) {
      updated += 1;
      maybeSample(row, fixed, "updated");
      if (outcome.reasons.length > 0) {
        still_flagged += 1;
        bump(slug, "still_flagged");
      }
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

  const nextLastId = rows.length > 0 ? rows[rows.length - 1].id : afterId;

  return {
    scanned: rows.length,
    cleared,
    source_limited,
    hide,
    updated,
    unchanged,
    still_flagged,
    last_id: afterId,
    next_last_id: nextLastId,
    complete: rows.length < BATCH,
    reembed_resource_ids,
    by_source,
    samples,
    hide_samples,
    duplicate_tracker,
  };
}

export const NEEDS_REVIEW_BULK_FIX_JOB_KEY = "needs_review_bulk_fix_202510";

/** Re-open completed job when APPLY env toggles so apply pass runs from the start. */
export async function requeueNeedsReviewBulkFixJobIfModeChanged(
  db: Queryable,
): Promise<{ requeued: boolean; previous_mode: string | null; current_mode: NeedsReviewBulkFixMode }> {
  const current_mode = currentNeedsReviewBulkFixMode();
  const row = await db.query<{
    status: string;
    progress: Record<string, unknown>;
    result: Record<string, unknown> | null;
  }>(
    `SELECT status, progress, result FROM post_deploy_jobs WHERE job_key = $1`,
    [NEEDS_REVIEW_BULK_FIX_JOB_KEY],
  );
  const job = row.rows[0];
  if (!job) {
    return { requeued: false, previous_mode: null, current_mode };
  }
  const stored =
    (typeof job.result?.mode === "string" ? job.result.mode : null)
    ?? (typeof job.progress?.mode === "string" ? job.progress.mode : null);
  if (!stored || stored === current_mode) {
    return { requeued: false, previous_mode: stored, current_mode };
  }
  const fresh = initialNeedsReviewBulkFixProgress(current_mode, {
    mode_reset_from: stored,
    mode_reset_at: new Date().toISOString(),
  });
  await db.query(
    `UPDATE post_deploy_jobs
     SET status = 'pending',
         progress = $2::jsonb,
         result = NULL,
         completed_at = NULL,
         started_at = NULL,
         last_error = NULL,
         updated_at = now()
     WHERE job_key = $1`,
    [NEEDS_REVIEW_BULK_FIX_JOB_KEY, JSON.stringify(fresh)],
  );
  return { requeued: true, previous_mode: stored, current_mode };
}
