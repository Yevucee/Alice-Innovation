import { randomUUID } from "node:crypto";
import {
  completePostDeployJob,
  hasPendingPostDeployJobs,
  listActivePostDeployJobs,
  listPostDeployJobs,
  markPostDeployJobInProgress,
  notePostDeployJobError,
  primaryProgressOffset,
  runQualityAudit,
  runDataQualityRepairBatch,
  runEmbeddingBackfillForResourceIds,
  runRestoreTitleMatchedOrganisationsBatch,
  runAllCapsTitleRepairBatch,
  backfillReviewReasonCodesBatch,
  cleanJStartupResourceSummariesBatch,
  quarantineAsiaCatalogueJunkBatch,
  setPostDeployJobLastRun,
  updatePostDeployJobProgress,
  type PostDeployJobLastRun,
  type PostDeployJobStopReason,
  type PostDeployJobRow,
  type Queryable,
} from "@alice/database";
import { loadSources } from "@alice/source-registry";
import { embedTextsDetailed, embeddingSettings, embeddingVersion, log } from "@alice/shared";
import {
  backfillSourceItemImages,
  loadSourceItemsMissingImages,
} from "./image-backfill.js";
import { runIngestion } from "./pipeline.js";
import { getAdapter } from "./adapters/registry.js";
import { fetchText, HttpStatusError } from "./http.js";
import type { AdapterContext } from "./adapters/types.js";
import { runOrgRecoveryFromSourceBatch } from "./org-recovery-job.js";
import { runQualityContentBackfillBatch } from "./quality-content-backfill-job.js";
import { runNeedsReviewReconcileJobBatch, reembedReconcileBatch } from "./needs-review-reconcile-job.js";
import { getImageBackfillFailureTracker, resetImageBackfillFailureTracker } from "./image-backfill-failure-tracker.js";
import { getRunFailureTracker, resetRunFailureTracker } from "./run-failure-tracker.js";
import {
  applyImageBackfillStallGuard,
  bumpImageBackfillTotals,
  imageBackfillProgressFingerprint,
  postDeployJobMaxMinutesPerJob,
  readImageBackfillTotals,
} from "./post-deploy-image-backfill.js";

const REINGEST_SOURCES = [
  "su-launchlab",
  "kenya-climate-innovation-centre",
  "global-startup-awards-africa",
  "norrsken-100",
  "norrsken-accelerator",
  "oceanhub-africa",
  "africa-tech-festival-startup-hub",
] as const;

const LISTING_IMAGE_SOURCES = ["norrsken-100", "injini-african-edtech-map"] as const;
const PAGE_IMAGE_SOURCES = ["project-drawdown", "mit-solve"] as const;

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

export function postDeployJobsEnabled(): boolean {
  return envFlag("POST_DEPLOY_JOBS_ON_INGEST", true);
}

/** @deprecated use shouldRunPostDeployBeforeIngest */
export function postDeployBeforeIngestEnabled(): boolean {
  return false;
}

export function isRailwayCronRun(): boolean {
  return process.env.RAILWAY_CRON === "1" || process.env.RAILWAY_CRON === "true";
}

export function isManualIngestTrigger(): boolean {
  if (process.argv.includes("--cleanup-only")) return true;
  if (process.argv.includes("--source") || process.argv.includes("--full") || process.argv.includes("--limit")) {
    return true;
  }
  return !isRailwayCronRun();
}

function postDeployBeforeIngestDefault(): boolean {
  return !isManualIngestTrigger();
}

export async function shouldRunPostDeployBeforeIngest(
  db: Queryable,
  input: { cleanupOnly: boolean },
): Promise<boolean> {
  if (process.argv.includes("--post-deploy-after-ingest")) return false;
  if (process.argv.includes("--post-deploy-first")) return true;
  if (!envFlag("POST_DEPLOY_BEFORE_INGEST", postDeployBeforeIngestDefault())) return false;
  if (input.cleanupOnly) return true;
  if (isManualIngestTrigger()) return envFlag("POST_DEPLOY_BEFORE_INGEST", false);
  if (await hasPendingPostDeployJobs(db)) return true;
  return false;
}

export interface PostDeployRunnerSummary {
  started_at: string;
  ended_at: string;
  minutes_used: number;
  rounds: number;
  steps: number;
  stop_reason: "disabled" | "no_pending_jobs" | "budget" | "error" | "done" | "no_steps";
  max_minutes: number;
  trigger: string;
  pending_job_keys: string[];
  reconcile_cleared: number;
  reconcile_source_limited: number;
  reconcile_still_flagged: number;
}

type JobStepStats = {
  offset_before: number | null;
  offset_after: number | null;
  steps: number;
  ms: number;
  stop_reason: PostDeployJobStopReason;
};

function roundMinutes(ms: number): number {
  return Math.round((ms / 60_000) * 10) / 10;
}

function logPostDeployJobRunLine(input: {
  job_key: string;
  started_at: string;
  minutes_used: number;
  offset_before: number | null;
  offset_after: number | null;
  stop_reason: PostDeployJobStopReason;
  steps: number;
  rounds: number;
}): void {
  const offsetPart = input.offset_before != null || input.offset_after != null
    ? ` offset ${input.offset_before ?? "—"}→${input.offset_after ?? "—"}`
    : "";
  log("info", "post_deploy_job_run_summary", {
    job_key: input.job_key,
    started_at: input.started_at,
    minutes_used: input.minutes_used,
    offset_before: input.offset_before,
    offset_after: input.offset_after,
    stop_reason: input.stop_reason,
    steps: input.steps,
    rounds: input.rounds,
    line: `post-deploy ${input.job_key}: started ${input.started_at}, ${input.minutes_used} min,${offsetPart}, stop=${input.stop_reason}`,
  });
}

async function persistJobLastRun(
  db: Queryable,
  input: {
    job_key: string;
    session_id: string;
    trigger: string;
    session_started_at: string;
    session_ended_at: string;
    stats: JobStepStats;
    rounds: number;
  },
): Promise<void> {
  const lastRun: PostDeployJobLastRun = {
    started_at: input.session_started_at,
    ended_at: input.session_ended_at,
    minutes_used: roundMinutes(input.stats.ms),
    steps: input.stats.steps,
    rounds: input.rounds,
    offset_before: input.stats.offset_before,
    offset_after: input.stats.offset_after,
    stop_reason: input.stats.stop_reason,
    session_id: input.session_id,
    trigger: input.trigger,
  };
  await setPostDeployJobLastRun(db, input.job_key, { ...lastRun });
}

function reingestItemsPerRun(): number {
  const parsed = Number(process.env.POST_DEPLOY_REINGEST_ITEMS_PER_RUN ?? "120");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

function imageBackfillPerRun(): number {
  const parsed = Number(process.env.POST_DEPLOY_IMAGE_BACKFILL_PER_RUN ?? "80");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

function postDeployJobsMaxMinutes(): number {
  const parsed = Number(process.env.POST_DEPLOY_JOBS_MAX_MINUTES ?? "30");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

type ReingestProgress = {
  source_index: number;
  phase: "limit" | "full";
  limit_pass_done: boolean;
  sources_done: string[];
  consecutive_failures?: number;
  skipped_sources?: Record<string, string>;
};

function defaultReingestProgress(): ReingestProgress {
  return { source_index: 0, phase: "limit", limit_pass_done: false, sources_done: [], consecutive_failures: 0 };
}

function advanceReingestToNextSource(
  state: ReingestProgress,
  sourceId: string,
  stepResult: Record<string, unknown>,
  fullPassesRequired: number,
): Record<string, unknown> {
  const fullRuns = Number((state as { full_runs?: number }).full_runs ?? 0);
  void fullPassesRequired;
  void fullRuns;
  return {
    ...state,
    source_index: state.source_index + 1,
    phase: "limit",
    limit_pass_done: false,
    full_runs: 0,
    consecutive_failures: 0,
    sources_done: [...new Set([...state.sources_done, sourceId])],
    last_step: stepResult,
    complete: state.source_index + 1 >= REINGEST_SOURCES.length,
  };
}

async function runScraperReingestStep(db: Queryable, progress: Record<string, unknown>): Promise<Record<string, unknown>> {
  void db;
  const state: ReingestProgress = {
    ...defaultReingestProgress(),
    ...(progress as Partial<ReingestProgress>),
  };
  const fullPassesRequired = Number(process.env.POST_DEPLOY_FULL_PASSES_PER_SOURCE ?? "2");
  const fullRuns = Number((progress as { full_runs?: number }).full_runs ?? 0);

  if (state.source_index >= REINGEST_SOURCES.length) {
    return { ...state, complete: true };
  }

  const sourceId = REINGEST_SOURCES[state.source_index];
  const sources = loadSources();

  let limit: number | null;
  let full = false;
  if (!state.limit_pass_done) {
    limit = 40;
  } else {
    full = true;
    limit = reingestItemsPerRun();
  }

  log("info", "post_deploy_reingest_step", { source_id: sourceId, limit, full, full_runs: fullRuns });
  const result = await runIngestion({
    sources,
    only: [sourceId],
    dueOnly: false,
    limit,
    full,
    dryRun: false,
  });

  const stepResult = {
    source_id: sourceId,
    limit,
    full,
    failed: result.failedSources.includes(sourceId),
    touched_resources: result.touchedResourceIds.length,
    lock_skipped: result.ingestSkippedDueToLock,
  };

  if (result.ingestSkippedDueToLock) {
    return { ...state, full_runs: fullRuns, last_step: stepResult };
  }

  if (result.failedSources.includes(sourceId)) {
    const failCount = Number(state.consecutive_failures ?? 0) + 1;
    const skipped = { ...(state.skipped_sources ?? {}) };
    if (failCount >= 2) {
      skipped[sourceId] = `ingest_failed_${failCount}`;
      log("warn", "post_deploy_reingest_skip_source", { source_id: sourceId, fail_count: failCount });
      return advanceReingestToNextSource(
        { ...state, skipped_sources: skipped },
        sourceId,
        stepResult,
        fullPassesRequired,
      );
    }
    return {
      ...state,
      consecutive_failures: failCount,
      last_step: stepResult,
      last_failed_source: sourceId,
    };
  }

  const clearedFailures = { ...state, consecutive_failures: 0 };

  if (!clearedFailures.limit_pass_done) {
    return {
      ...clearedFailures,
      limit_pass_done: true,
      phase: "full",
      full_runs: 0,
      last_step: stepResult,
    };
  }

  const nextFullRuns = fullRuns + 1;
  if (nextFullRuns >= fullPassesRequired) {
    return advanceReingestToNextSource(clearedFailures, sourceId, stepResult, fullPassesRequired);
  }

  return {
    ...clearedFailures,
    full_runs: nextFullRuns,
    last_step: stepResult,
  };
}

async function runListingCardImageStep(db: Queryable, progress: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sourceIndex = Number(progress.listing_source_index ?? 0);
  if (sourceIndex >= LISTING_IMAGE_SOURCES.length) {
    return { ...progress, listing_complete: true };
  }
  const sourceSlug = LISTING_IMAGE_SOURCES[sourceIndex];
  const sources = loadSources();
  const source = sources.find((entry) => entry.id === sourceSlug);
  if (!source) {
    return { ...progress, listing_source_index: sourceIndex + 1 };
  }
  const adapter = getAdapter(source.adapter);
  if (!adapter) {
    return { ...progress, listing_source_index: sourceIndex + 1 };
  }

  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const minInterval = Math.ceil(60000 / Math.max(1, source.limits.requests_per_minute));
  let lastRequest = 0;
  const tracker = getImageBackfillFailureTracker();
  const fetchWithTracker = async (url: string) => {
    const skip = tracker.shouldSkipUrl(url);
    if (skip) {
      throw new HttpStatusError(`skipped:${skip}`, 0);
    }
    const wait = minInterval - (Date.now() - lastRequest);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    try {
      const result = await fetchText(url, { userAgent, timeoutMs, maxAttempts: 1 });
      tracker.recordSuccess(url);
      return result;
    } catch (error) {
      const status = error instanceof HttpStatusError ? error.status : null;
      tracker.recordFailure(url, status);
      throw error;
    }
  };
  const discoverCtx: AdapterContext = {
    source,
    userAgent,
    timeoutMs,
    limit: null,
    fetchText: async (url) => {
      const wait = minInterval - (Date.now() - lastRequest);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      return fetchText(url, { userAgent, timeoutMs, maxAttempts: 1 });
    },
  };
  const itemCtx: AdapterContext = { ...discoverCtx, fetchText: fetchWithTracker };

  let discovered: Awaited<ReturnType<NonNullable<typeof adapter.discover>>> = [];
  try {
    discovered = await adapter.discover(discoverCtx);
  } catch (error) {
    log("warn", "post_deploy_listing_discover_failed", {
      source_slug: sourceSlug,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const byExternalId = new Map(
    discovered.filter((ref) => ref.externalId).map((ref) => [ref.externalId!, ref]),
  );
  const rows = await loadSourceItemsMissingImages(db, { sourceSlug, limit: imageBackfillPerRun() });
  let updated = 0;
  for (const row of rows) {
    if (tracker.shouldSkipUrl(row.canonical_url)) continue;
    const ref = byExternalId.get(row.external_id);
    if (!ref?.listingHtml) continue;
    try {
      const page = await adapter.fetch(ref, itemCtx);
      const draft = adapter.parse(page);
      const imageUrl = draft.imageUrl?.trim();
      if (!imageUrl || imageUrl.startsWith("data:")) continue;
      await db.query(
        `UPDATE source_items SET image_url = $2, updated_at = now(), last_fetched_at = now() WHERE id = $1::uuid`,
        [row.id, imageUrl],
      );
      updated += 1;
    } catch {
      /* continue */
    }
  }

  const listingRuns = Number(progress.listing_runs ?? 0) + 1;
  const listingUpdated = Number(progress.listing_updated ?? 0) + updated;
  const nextIndex = rows.length < imageBackfillPerRun() || updated === 0 ? sourceIndex + 1 : sourceIndex;
  const fingerprintBefore = imageBackfillProgressFingerprint(progress);
  const totals = bumpImageBackfillTotals(readImageBackfillTotals(progress), {
    candidates: rows.length,
    updated,
    skipped: Math.max(0, rows.length - updated),
    failed: 0,
  });
  const merged = {
    ...progress,
    totals,
    listing_source_index: nextIndex,
    listing_runs: listingRuns,
    listing_updated: listingUpdated,
    listing_complete: nextIndex >= LISTING_IMAGE_SOURCES.length,
    last_listing_source: sourceSlug,
    last_listing_updated: updated,
    skip_reasons: tracker.skipReasonsSummary(),
  };
  const madeProgress = imageBackfillProgressFingerprint(merged) !== fingerprintBefore || updated > 0;
  return applyImageBackfillStallGuard(merged, madeProgress).progress;
}

function shouldAdvanceImageSourceIndex(
  rowCount: number,
  summary: { updated: number; skipped: number; failed?: number },
): boolean {
  const perRun = imageBackfillPerRun();
  if (rowCount < perRun) return true;
  if (summary.updated > 0) return false;
  const failed = summary.failed ?? 0;
  if (rowCount > 0 && summary.skipped + failed >= rowCount) return true;
  return false;
}

async function runBulkImageBackfillStep(db: Queryable, progress: Record<string, unknown>): Promise<Record<string, unknown>> {
  const fingerprintBefore = imageBackfillProgressFingerprint(progress);
  const failureTracker = getImageBackfillFailureTracker();
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);

  if (!progress.listing_complete) {
    return runListingCardImageStep(db, progress);
  }

  const pageIndex = Number(progress.page_source_index ?? 0);
  if (pageIndex < PAGE_IMAGE_SOURCES.length) {
    const sourceSlug = PAGE_IMAGE_SOURCES[pageIndex];
    const rows = await loadSourceItemsMissingImages(db, { sourceSlug, limit: imageBackfillPerRun() });
    const summary = await backfillSourceItemImages(db, rows, {
      userAgent,
      timeoutMs,
      validateRemote: true,
      minIntervalMs: 800,
      failureTracker,
    });
    const nextIndex = shouldAdvanceImageSourceIndex(rows.length, summary) ? pageIndex + 1 : pageIndex;
    const totals = bumpImageBackfillTotals(readImageBackfillTotals(progress), summary);
    const merged = {
      ...progress,
      totals,
      page_source_index: nextIndex,
      page_backfill_runs: Number(progress.page_backfill_runs ?? 0) + 1,
      page_backfill_updated: Number(progress.page_backfill_updated ?? 0) + summary.updated,
      page_sources_done: nextIndex >= PAGE_IMAGE_SOURCES.length,
      last_page_source: sourceSlug,
      last_page_summary: summary,
      skip_reasons: failureTracker.skipReasonsSummary(),
    };
    const madeProgress =
      imageBackfillProgressFingerprint(merged) !== fingerprintBefore || summary.updated > 0;
    return applyImageBackfillStallGuard(merged, madeProgress).progress;
  }

  const globalOffset = Number(progress.global_offset ?? 0);
  const globalRows = await loadSourceItemsMissingImages(db, {
    limit: imageBackfillPerRun(),
    offset: globalOffset,
  });
  if (globalRows.length === 0) {
    return { ...progress, complete: true, global_remaining: 0 };
  }
  const summary = await backfillSourceItemImages(db, globalRows, {
    userAgent,
    timeoutMs,
    validateRemote: true,
    minIntervalMs: 800,
    failureTracker,
  });
  const nextGlobalOffset = globalOffset + globalRows.length;
  const totals = bumpImageBackfillTotals(readImageBackfillTotals(progress), summary);
  const merged = {
    ...progress,
    totals,
    global_offset: nextGlobalOffset,
    global_backfill_runs: Number(progress.global_backfill_runs ?? 0) + 1,
    global_backfill_updated: Number(progress.global_backfill_updated ?? 0) + summary.updated,
    global_remaining: globalRows.length - summary.updated,
    last_global_summary: summary,
    skip_reasons: failureTracker.skipReasonsSummary(),
    complete: globalRows.length < imageBackfillPerRun(),
  };
  const madeProgress =
    imageBackfillProgressFingerprint(merged) !== fingerprintBefore || summary.updated > 0;
  const guarded = applyImageBackfillStallGuard(merged, madeProgress);
  if (guarded.stalled && !merged.complete) {
    return {
      ...guarded.progress,
      global_offset: nextGlobalOffset,
      consecutive_stall_steps: 0,
      stall_skip_advanced: globalRows.length,
    };
  }
  return guarded.progress;
}

async function runAsiaCatalogueQualityStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const totals = { ...((progress.totals as Record<string, number>) ?? {}) };
  const offset = Number(progress.offset ?? 0);
  const batchSize = 120;
  const quarantine = await quarantineAsiaCatalogueJunkBatch(db, batchSize);
  bumpTotal(totals, "quarantined", quarantine.quarantined);
  const cleaned = await cleanJStartupResourceSummariesBatch(db, batchSize);
  bumpTotal(totals, "j_startup_summaries_cleaned", cleaned.cleaned);
  bumpTotal(totals, "j_startup_sensors_cleared", cleaned.cleared_sensors_only);
  const complete = quarantine.quarantined === 0 && cleaned.cleaned === 0 && cleaned.cleared_sensors_only === 0;
  return {
    offset: offset + batchSize,
    totals,
    complete,
    last_quarantine_ids: quarantine.resource_ids.slice(0, 20),
  };
}

async function runTitleCaseRepairStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const totals = { ...(progress.totals as Record<string, number> | undefined) };
  const offset = Number(progress.offset ?? 0);
  const repair = await runAllCapsTitleRepairBatch(db, offset);
  bumpTotal(totals, "scanned", repair.scanned);
  bumpTotal(totals, "titles_repaired", repair.titles_repaired);
  bumpTotal(totals, "cleared_review", repair.cleared_review);
  if (repair.reembed_resource_ids.length > 0) {
    await reembedReconcileBatch(db, repair.reembed_resource_ids);
    bumpTotal(totals, "reembedded", repair.reembed_resource_ids.length);
  }
  return {
    offset: repair.next_offset,
    totals,
    complete: repair.complete,
    titles_repaired_total: totals.titles_repaired ?? 0,
  };
}

type DataQualityProgress = {
  dq_offset: number;
  dq_retype_done: boolean;
  pending_reembed_ids: string[];
  totals: Record<string, number>;
};

function defaultDataQualityProgress(): DataQualityProgress {
  return {
    dq_offset: 0,
    dq_retype_done: false,
    pending_reembed_ids: [],
    totals: {},
  };
}

function bumpTotal(totals: Record<string, number>, key: string, delta: number): void {
  totals[key] = (totals[key] ?? 0) + delta;
}

async function reembedResourceIds(
  db: Queryable,
  resourceIds: string[],
): Promise<{ embedded: number; failed: number; skipped: boolean }> {
  if (resourceIds.length === 0) return { embedded: 0, failed: 0, skipped: false };
  const settings = embeddingSettings();
  if (!settings.apiKey) {
    log("warn", "post_deploy_dq_reembed_skipped", { reason: "EMBEDDING_API_KEY not set", count: resourceIds.length });
    return { embedded: 0, failed: 0, skipped: true };
  }
  const version = embeddingVersion(settings);
  const embedBatch = async (texts: string[]) => {
    const result = await embedTextsDetailed(texts, { maxAttempts: 4 });
    return {
      vectors: result.vectors,
      usage: result.usage ? { total_tokens: result.usage.total_tokens } : undefined,
      status: result.status,
      retryable: result.retryable,
    };
  };
  const summary = await runEmbeddingBackfillForResourceIds(db, resourceIds, {
    embedBatch,
    model: settings.model,
    version,
    throwOnConsecutiveFailures: false,
  });
  return { embedded: summary.embedded, failed: summary.failed, skipped: false };
}

async function runDataQualityRepairStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const state: DataQualityProgress = {
    ...defaultDataQualityProgress(),
    ...(progress as Partial<DataQualityProgress>),
    totals: { ...defaultDataQualityProgress().totals, ...((progress.totals as Record<string, number>) ?? {}) },
  };

  const batch = await runDataQualityRepairBatch(db, {
    offset: state.dq_offset,
    retypeApoliticalDone: state.dq_retype_done,
  });

  const totals = { ...state.totals };
  bumpTotal(totals, "scanned", batch.scanned);
  bumpTotal(totals, "orgs_rejected", batch.orgs_rejected);
  bumpTotal(totals, "org_links_removed", batch.org_links_removed);
  bumpTotal(totals, "orphan_orgs_deleted", batch.orphan_orgs_deleted);
  bumpTotal(totals, "summaries_repaired", batch.summaries_repaired);
  bumpTotal(totals, "titles_repaired", batch.titles_repaired);
  bumpTotal(totals, "resources_retyped", batch.resources_retyped);
  bumpTotal(totals, "countries_normalised", batch.countries_normalised);
  bumpTotal(totals, "resources_updated", batch.resources_updated);

  const pending = [...new Set([...state.pending_reembed_ids, ...batch.reembed_resource_ids])];
  let reembed = { embedded: 0, failed: 0, skipped: false };

  if (batch.complete && pending.length > 0) {
    reembed = await reembedResourceIds(db, pending);
    bumpTotal(totals, "reembedded", reembed.embedded);
    bumpTotal(totals, "reembed_failed", reembed.failed);
    if (!reembed.skipped) {
      pending.length = 0;
    }
  }

  const next: DataQualityProgress = {
    dq_offset: batch.next_offset,
    dq_retype_done: true,
    pending_reembed_ids: pending,
    totals,
  };

  const repairComplete = batch.complete && (pending.length === 0 || reembed.skipped);

  return {
    ...next,
    complete: repairComplete,
    last_batch: {
      offset: batch.offset,
      scanned: batch.scanned,
      resources_updated: batch.resources_updated,
    },
    reembed_last: reembed,
  };
}

type RestoreOrgProgress = {
  restore_offset: number;
  restore_complete: boolean;
  review_reason_offset: number;
  review_reason_complete: boolean;
  totals: Record<string, number>;
};

async function runRestoreTitleMatchedOrgsStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const state: RestoreOrgProgress = {
    restore_offset: 0,
    restore_complete: false,
    review_reason_offset: 0,
    review_reason_complete: false,
    totals: {},
    ...(progress as Partial<RestoreOrgProgress>),
  };
  const totals = { ...state.totals };

  if (!state.restore_complete) {
    const batch = await runRestoreTitleMatchedOrganisationsBatch(db, { offset: state.restore_offset });
    bumpTotal(totals, "orgs_restored", batch.restored);
    bumpTotal(totals, "restore_scanned", batch.scanned);
    bumpTotal(totals, "restore_skipped", batch.skipped);
    log("info", "post_deploy_org_title_restore_batch", {
      restored: batch.restored,
      scanned: batch.scanned,
      skipped: batch.skipped,
      offset: batch.offset,
    });
    return {
      ...state,
      restore_offset: batch.next_offset,
      restore_complete: batch.complete,
      totals,
      complete: false,
    };
  }

  if (!state.review_reason_complete) {
    const backfill = await backfillReviewReasonCodesBatch(db, { offset: state.review_reason_offset });
    bumpTotal(totals, "review_reasons_backfilled", backfill.updated);
    bumpTotal(totals, "review_reasons_scanned", backfill.scanned);
    return {
      ...state,
      review_reason_offset: backfill.next_offset,
      review_reason_complete: backfill.complete,
      totals,
      complete: backfill.complete,
    };
  }

  return { ...state, totals, complete: true };
}

async function runOrgRecoveryFromSourceStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const phase = String(progress.phase ?? "mit-solve");
  const offset = Number(progress.offset ?? 0);
  const totals = { ...(progress.totals as Record<string, number> | undefined) };
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const minIntervalMs = 800;

  const batch = await runOrgRecoveryFromSourceBatch(db, {
    offset,
    sourceSlugs: phase === "mit-solve" ? ["mit-solve"] : null,
    tracker: getRunFailureTracker(),
    userAgent,
    timeoutMs,
    minIntervalMs,
  });

  bumpTotal(totals, "orgs_recovered", batch.orgs_recovered);
  bumpTotal(totals, "not_found", batch.not_found);
  bumpTotal(totals, "skipped_fetch", batch.skipped_fetch);

  let nextPhase = phase;
  let nextOffset = batch.next_offset;
  if (batch.complete && phase === "mit-solve") {
    nextPhase = "all";
    nextOffset = 0;
  }

  const complete = batch.complete && phase === "all";
  const pendingReembed = [
    ...new Set([
      ...((progress.pending_reembed_ids as string[]) ?? []),
      ...batch.reembed_resource_ids,
    ]),
  ];

  if (complete && pendingReembed.length > 0) {
    const reembed = await reembedResourceIds(db, pendingReembed);
    bumpTotal(totals, "reembedded", reembed.embedded);
    if (!reembed.skipped) pendingReembed.length = 0;
  }

  return {
    phase: nextPhase,
    offset: nextOffset,
    totals,
    pending_reembed_ids: pendingReembed,
    complete: complete && pendingReembed.length === 0,
    last_batch: batch,
  };
}

async function runQualityDetailBackfillStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const offset = Number(progress.offset ?? 0);
  const totals = { ...(progress.totals as Record<string, number> | undefined) };
  const batch = await runQualityContentBackfillBatch(db, { offset, tracker: getRunFailureTracker() });
  bumpTotal(totals, "updated", batch.updated);
  bumpTotal(totals, "scanned", batch.scanned);
  const pending = [
    ...new Set([
      ...((progress.pending_reembed_ids as string[]) ?? []),
      ...batch.reembed_resource_ids,
    ]),
  ];
  const complete = batch.complete;
  if (complete && pending.length > 0) {
    const reembed = await reembedResourceIds(db, pending);
    bumpTotal(totals, "reembedded", reembed.embedded);
    if (!reembed.skipped) pending.length = 0;
  }
  return {
    offset: batch.next_offset,
    totals,
    pending_reembed_ids: pending,
    complete: complete && pending.length === 0,
  };
}

async function runNeedsReviewReconcileStep(
  db: Queryable,
  progress: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const totals = { ...(progress.totals as Record<string, number> | undefined) };

  if (!progress.all_caps_complete) {
    const allCapsOffset = Number(progress.all_caps_offset ?? 0);
    const repair = await runAllCapsTitleRepairBatch(db, allCapsOffset);
    bumpTotal(totals, "all_caps_scanned", repair.scanned);
    bumpTotal(totals, "all_caps_titles_repaired", repair.titles_repaired);
    bumpTotal(totals, "all_caps_cleared", repair.cleared_review);
    if (repair.reembed_resource_ids.length > 0) {
      await reembedReconcileBatch(db, repair.reembed_resource_ids);
    }
    if (!repair.complete) {
      return {
        ...progress,
        all_caps_offset: repair.next_offset,
        totals,
        complete: false,
      };
    }
    progress = { ...progress, all_caps_complete: true, all_caps_offset: repair.next_offset, totals };
  }

  const offset = Number(progress.offset ?? 0);
  const batch = await runNeedsReviewReconcileJobBatch(db, offset);
  bumpTotal(totals, "scanned", batch.scanned);
  bumpTotal(totals, "cleared", batch.cleared);
  bumpTotal(totals, "source_limited", batch.source_limited);
  bumpTotal(totals, "still_flagged", batch.still_flagged);
  const pending = [
    ...new Set([
      ...((progress.pending_reembed_ids as string[]) ?? []),
      ...batch.reembed_resource_ids,
    ]),
  ];
  const complete = batch.complete;
  if (batch.reembed_resource_ids.length > 0) {
    const embedded = await reembedReconcileBatch(db, batch.reembed_resource_ids);
    bumpTotal(totals, "reembedded", embedded);
  }
  if (complete && pending.length > 0) {
    const reembed = await reembedResourceIds(db, pending);
    bumpTotal(totals, "reembedded", (totals.reembedded ?? 0) + reembed.embedded);
    if (!reembed.skipped) pending.length = 0;
  }
  return {
    offset: batch.next_offset,
    totals,
    pending_reembed_ids: pending,
    complete: complete && pending.length === 0,
  };
}

async function executePostDeployJobStep(
  db: Queryable,
  job: PostDeployJobRow,
  runContext: {
    sessionId: string;
    trigger: string;
    sessionStartedAt: string;
    rounds: number;
    jobStats: Map<string, JobStepStats>;
    budgetExhausted: () => boolean;
  },
): Promise<void> {
  const progress = { ...(job.progress ?? {}) };
  const offsetBefore = primaryProgressOffset(progress);
  const stepStarted = Date.now();
  let stats = runContext.jobStats.get(job.job_key);
  if (!stats) {
    stats = {
      offset_before: offsetBefore,
      offset_after: offsetBefore,
      steps: 0,
      ms: 0,
      stop_reason: "not_run",
    };
    runContext.jobStats.set(job.job_key, stats);
  } else if (stats.offset_before == null) {
    stats.offset_before = offsetBefore;
  }

  await markPostDeployJobInProgress(db, job.job_key, progress);

  try {
    let nextProgress: Record<string, unknown> = progress;
    let complete = false;
    let result: Record<string, unknown> = {};

    switch (job.job_key) {
      case "org_recovery_from_source_202510": {
        nextProgress = await runOrgRecoveryFromSourceStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>) };
        break;
      }
      case "restore_title_matched_orgs_202510": {
        nextProgress = await runRestoreTitleMatchedOrgsStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>) };
        break;
      }
      case "scraper_reingest_202510": {
        nextProgress = await runScraperReingestStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { last_step: nextProgress.last_step, sources_done: nextProgress.sources_done };
        break;
      }
      case "cohort_quality_audit_202510": {
        result = await runQualityAudit(db, {
          resourceIds: null,
          limit: null,
          dryRun: false,
          apply: true,
        }).then((summary) => ({
          scanned: summary.scanned,
          flagged: summary.flagged,
          reason_counts: summary.reason_counts,
        }));
        complete = true;
        nextProgress = { ...progress, audit_applied: true };
        break;
      }
      case "bulk_image_backfill_202510": {
        nextProgress = await runBulkImageBackfillStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = {
          totals: nextProgress.totals,
          listing_updated: nextProgress.listing_updated,
          page_backfill_updated: nextProgress.page_backfill_updated,
          global_backfill_updated: nextProgress.global_backfill_updated,
          global_offset: nextProgress.global_offset,
        };
        break;
      }
      case "title_case_repair_202610": {
        nextProgress = await runTitleCaseRepairStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>), titles_repaired_total: nextProgress.titles_repaired_total };
        break;
      }
      case "data_quality_repair_202510": {
        nextProgress = await runDataQualityRepairStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>), reembed_last: nextProgress.reembed_last };
        break;
      }
      case "quality_detail_backfill_202510": {
        nextProgress = await runQualityDetailBackfillStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>) };
        break;
      }
      case "needs_review_reconcile_202510": {
        nextProgress = await runNeedsReviewReconcileStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>) };
        break;
      }
      case "asia_catalogue_quality_202510": {
        nextProgress = await runAsiaCatalogueQualityStep(db, progress);
        complete = Boolean(nextProgress.complete);
        result = { ...(nextProgress.totals as Record<string, unknown>) };
        break;
      }
      default:
        log("warn", "post_deploy_job_unknown", { job_key: job.job_key });
        await completePostDeployJob(db, job.job_key, { skipped: true });
        return;
    }

    if (complete) {
      await completePostDeployJob(db, job.job_key, result);
      log("info", "post_deploy_job_completed", { job_key: job.job_key, result });
      stats.offset_after = primaryProgressOffset(nextProgress);
      stats.steps += 1;
      stats.ms += Date.now() - stepStarted;
      stats.stop_reason = "done";
    } else {
      await updatePostDeployJobProgress(db, job.job_key, nextProgress);
      log("info", "post_deploy_job_progress", { job_key: job.job_key, progress: nextProgress });
      stats.offset_after = primaryProgressOffset(nextProgress);
      stats.steps += 1;
      stats.ms += Date.now() - stepStarted;
      stats.stop_reason = runContext.budgetExhausted() ? "budget" : "progress";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await notePostDeployJobError(db, job.job_key, message, progress);
    log("warn", "post_deploy_job_step_failed", { job_key: job.job_key, message });
    stats.steps += 1;
    stats.ms += Date.now() - stepStarted;
    stats.stop_reason = "error";
  }
}

export async function runPostDeployJobsStep(
  db: Queryable,
  input?: { trigger?: string },
): Promise<PostDeployRunnerSummary> {
  const trigger = input?.trigger ?? "post_ingest";
  const sessionId = randomUUID();
  const sessionStartedAt = new Date().toISOString();
  const startedMs = Date.now();
  const maxMinutes = postDeployJobsMaxMinutes();

  const emptySummary = (stop_reason: PostDeployRunnerSummary["stop_reason"], pending: string[]): PostDeployRunnerSummary => ({
    started_at: sessionStartedAt,
    ended_at: new Date().toISOString(),
    minutes_used: 0,
    rounds: 0,
    steps: 0,
    stop_reason,
    max_minutes: maxMinutes,
    trigger,
    pending_job_keys: pending,
    reconcile_cleared: 0,
    reconcile_source_limited: 0,
    reconcile_still_flagged: 0,
  });

  if (!postDeployJobsEnabled()) {
    log("info", "post_deploy_jobs_skipped", { reason: "POST_DEPLOY_JOBS_ON_INGEST=false", trigger });
    return emptySummary("disabled", []);
  }

  const pendingSnapshot = await listPostDeployJobs(db);
  const pendingKeys = pendingSnapshot
    .filter((row) => row.status === "pending" || row.status === "in_progress")
    .map((row) => row.job_key);

  log("info", "post_deploy_jobs_run_start", {
    trigger,
    session_id: sessionId,
    max_minutes: maxMinutes,
    per_job_max_minutes: postDeployJobMaxMinutesPerJob(),
    pending_jobs: pendingKeys.length,
    pending_job_keys: pendingKeys,
  });

  if (pendingKeys.length === 0) {
    log("info", "post_deploy_jobs_none_pending", { trigger });
    return emptySummary("no_pending_jobs", []);
  }

  resetRunFailureTracker();
  resetImageBackfillFailureTracker();
  const deadlineMs = startedMs + maxMinutes * 60 * 1000;
  const perJobBudgetMs = postDeployJobMaxMinutesPerJob() * 60 * 1000;
  const jobSessionMs = new Map<string, number>();
  let rounds = 0;
  let steps = 0;
  const jobStats = new Map<string, JobStepStats>();
  let stopReason: PostDeployRunnerSummary["stop_reason"] = "done";

  const runContext = {
    sessionId,
    trigger,
    sessionStartedAt,
    rounds: 0,
    jobStats,
    budgetExhausted: () => Date.now() >= deadlineMs,
  };

  try {
    while (Date.now() < deadlineMs) {
      const jobs = await listActivePostDeployJobs(db);
      if (jobs.length === 0) {
        stopReason = steps === 0 ? "no_pending_jobs" : "done";
        break;
      }

      runContext.rounds = rounds + 1;
      let ranJobStep = false;
      for (const job of jobs) {
        if (Date.now() >= deadlineMs) {
          stopReason = "budget";
          break;
        }
        const jobMs = jobSessionMs.get(job.job_key) ?? 0;
        if (jobMs >= perJobBudgetMs) {
          continue;
        }
        const stepStarted = Date.now();
        await executePostDeployJobStep(db, job, runContext);
        jobSessionMs.set(job.job_key, jobMs + (Date.now() - stepStarted));
        steps += 1;
        ranJobStep = true;
      }
      if (!ranJobStep) {
        stopReason = "budget";
        break;
      }
      rounds += 1;
      if (Date.now() >= deadlineMs) {
        stopReason = "budget";
        break;
      }
    }
    if (stopReason === "done" && Date.now() >= deadlineMs && steps > 0) {
      stopReason = "budget";
    }
  } catch (error) {
    stopReason = "error";
    log("warn", "post_deploy_jobs_run_failed", {
      message: error instanceof Error ? error.message : String(error),
      rounds,
      steps,
      trigger,
      session_id: sessionId,
    });
  }

  const sessionEndedAt = new Date().toISOString();
  const sessionMs = Date.now() - startedMs;
  const finalSnapshot = await listPostDeployJobs(db);

  if (steps === 0 && pendingKeys.length > 0) {
    stopReason = "no_steps";
  }

  for (const jobKey of pendingKeys) {
    const finalProgress = finalSnapshot.find((row) => row.job_key === jobKey)?.progress ?? {};
    const stats = jobStats.get(jobKey) ?? {
      offset_before: primaryProgressOffset(
        pendingSnapshot.find((row) => row.job_key === jobKey)?.progress ?? {},
      ),
      offset_after: primaryProgressOffset(finalProgress),
      steps: 0,
      ms: 0,
      stop_reason: "not_run" as PostDeployJobStopReason,
    };
    if (stats.steps === 0) {
      stats.offset_after = primaryProgressOffset(finalProgress);
    }
    if (stats.steps === 0 && stats.stop_reason === "not_run" && stopReason === "budget") {
      stats.stop_reason = "not_run";
    } else if (stats.steps > 0 && stats.stop_reason === "progress" && stopReason === "budget") {
      stats.stop_reason = "budget";
    }
    await persistJobLastRun(db, {
      job_key: jobKey,
      session_id: sessionId,
      trigger,
      session_started_at: sessionStartedAt,
      session_ended_at: sessionEndedAt,
      stats,
      rounds,
    });
    logPostDeployJobRunLine({
      job_key: jobKey,
      started_at: sessionStartedAt,
      minutes_used: stats.steps > 0 ? roundMinutes(stats.ms) : 0,
      offset_before: stats.offset_before,
      offset_after: stats.offset_after,
      stop_reason: stats.stop_reason,
      steps: stats.steps,
      rounds,
    });
  }

  const reconcileJob = finalSnapshot.find((row) => row.job_key === "needs_review_reconcile_202510");
  const reconcileTotals = (reconcileJob?.progress?.totals ?? {}) as Record<string, number>;

  const summary: PostDeployRunnerSummary = {
    started_at: sessionStartedAt,
    ended_at: sessionEndedAt,
    minutes_used: roundMinutes(sessionMs),
    rounds,
    steps,
    stop_reason: stopReason,
    max_minutes: maxMinutes,
    trigger,
    pending_job_keys: pendingKeys,
    reconcile_cleared: reconcileTotals.cleared ?? 0,
    reconcile_source_limited: reconcileTotals.source_limited ?? 0,
    reconcile_still_flagged: reconcileTotals.still_flagged ?? 0,
  };

  log("info", "post_deploy_jobs_run_complete", {
    ...summary,
    skip_reasons: getRunFailureTracker().skipReasonsSummary(),
    line: `post-deploy runner: ${summary.minutes_used}/${summary.max_minutes} min, ${summary.steps} steps, ${summary.rounds} rounds, stop=${summary.stop_reason}, trigger=${trigger}`,
  });

  if (steps === 0 && pendingKeys.length > 0) {
    log("warn", "post_deploy_jobs_zero_steps", {
      trigger,
      pending_job_keys: pendingKeys,
      hint: "Post-deploy queue did not advance — check POST_DEPLOY_JOBS_ON_INGEST or whether post-ingest ran after a long ingest.",
    });
  }

  return summary;
}
