import {
  completePostDeployJob,
  getActivePostDeployJob,
  markPostDeployJobInProgress,
  notePostDeployJobError,
  runQualityAudit,
  updatePostDeployJobProgress,
  type Queryable,
} from "@alice/database";
import { loadSources } from "@alice/source-registry";
import { log } from "@alice/shared";
import {
  backfillSourceItemImages,
  loadSourceItemsMissingImages,
} from "./image-backfill.js";
import { runIngestion } from "./pipeline.js";
import { getAdapter } from "./adapters/registry.js";
import { fetchText } from "./http.js";
import type { AdapterContext } from "./adapters/types.js";

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

function reingestItemsPerRun(): number {
  const parsed = Number(process.env.POST_DEPLOY_REINGEST_ITEMS_PER_RUN ?? "120");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

function imageBackfillPerRun(): number {
  const parsed = Number(process.env.POST_DEPLOY_IMAGE_BACKFILL_PER_RUN ?? "80");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

type ReingestProgress = {
  source_index: number;
  phase: "limit" | "full";
  limit_pass_done: boolean;
  sources_done: string[];
};

function defaultReingestProgress(): ReingestProgress {
  return { source_index: 0, phase: "limit", limit_pass_done: false, sources_done: [] };
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
    return { ...state, full_runs: fullRuns, last_step: stepResult, last_failed_source: sourceId };
  }

  if (!state.limit_pass_done) {
    return {
      ...state,
      limit_pass_done: true,
      phase: "full",
      full_runs: 0,
      last_step: stepResult,
    };
  }

  const nextFullRuns = fullRuns + 1;
  if (nextFullRuns >= fullPassesRequired) {
    return {
      ...state,
      source_index: state.source_index + 1,
      phase: "limit",
      limit_pass_done: false,
      full_runs: 0,
      sources_done: [...new Set([...state.sources_done, sourceId])],
      last_step: stepResult,
      complete: state.source_index + 1 >= REINGEST_SOURCES.length,
    };
  }

  return {
    ...state,
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
  const ctx: AdapterContext = {
    source,
    userAgent,
    timeoutMs,
    limit: null,
    fetchText: async (url) => {
      const wait = minInterval - (Date.now() - lastRequest);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      return fetchText(url, { userAgent, timeoutMs });
    },
  };

  const discovered = await adapter.discover(ctx);
  const byExternalId = new Map(
    discovered.filter((ref) => ref.externalId).map((ref) => [ref.externalId!, ref]),
  );
  const rows = await loadSourceItemsMissingImages(db, { sourceSlug, limit: imageBackfillPerRun() });
  let updated = 0;
  for (const row of rows) {
    const ref = byExternalId.get(row.external_id);
    if (!ref?.listingHtml) continue;
    try {
      const page = await adapter.fetch(ref, ctx);
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
  const nextIndex = rows.length < imageBackfillPerRun() ? sourceIndex + 1 : sourceIndex;
  return {
    ...progress,
    listing_source_index: nextIndex,
    listing_runs: listingRuns,
    listing_updated: listingUpdated,
    listing_complete: nextIndex >= LISTING_IMAGE_SOURCES.length,
    last_listing_source: sourceSlug,
    last_listing_updated: updated,
  };
}

async function runBulkImageBackfillStep(db: Queryable, progress: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!progress.listing_complete) {
    return runListingCardImageStep(db, progress);
  }

  const pageIndex = Number(progress.page_source_index ?? 0);
  if (pageIndex < PAGE_IMAGE_SOURCES.length) {
    const sourceSlug = PAGE_IMAGE_SOURCES[pageIndex];
    const rows = await loadSourceItemsMissingImages(db, { sourceSlug, limit: imageBackfillPerRun() });
    const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
    const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
    const summary = await backfillSourceItemImages(db, rows, {
      userAgent,
      timeoutMs,
      validateRemote: true,
      minIntervalMs: 800,
    });
    const nextIndex = rows.length < imageBackfillPerRun() ? pageIndex + 1 : pageIndex;
    return {
      ...progress,
      page_source_index: nextIndex,
      page_backfill_runs: Number(progress.page_backfill_runs ?? 0) + 1,
      page_backfill_updated: Number(progress.page_backfill_updated ?? 0) + summary.updated,
      page_sources_done: nextIndex >= PAGE_IMAGE_SOURCES.length,
      last_page_source: sourceSlug,
      last_page_summary: summary,
    };
  }

  const globalRows = await loadSourceItemsMissingImages(db, { limit: imageBackfillPerRun() });
  if (globalRows.length === 0) {
    return { ...progress, complete: true, global_remaining: 0 };
  }
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const summary = await backfillSourceItemImages(db, globalRows, {
    userAgent,
    timeoutMs,
    validateRemote: true,
    minIntervalMs: 800,
  });
  return {
    ...progress,
    global_backfill_runs: Number(progress.global_backfill_runs ?? 0) + 1,
    global_backfill_updated: Number(progress.global_backfill_updated ?? 0) + summary.updated,
    global_remaining: globalRows.length - summary.updated,
    last_global_summary: summary,
    complete: globalRows.length < imageBackfillPerRun(),
  };
}

export async function runPostDeployJobsStep(db: Queryable): Promise<void> {
  if (!postDeployJobsEnabled()) {
    log("info", "post_deploy_jobs_skipped", { reason: "POST_DEPLOY_JOBS_ON_INGEST=false" });
    return;
  }

  const job = await getActivePostDeployJob(db);
  if (!job) {
    log("info", "post_deploy_jobs_none_pending");
    return;
  }

  const progress = { ...(job.progress ?? {}) };
  await markPostDeployJobInProgress(db, job.job_key, progress);

  try {
    let nextProgress: Record<string, unknown> = progress;
    let complete = false;
    let result: Record<string, unknown> = {};

    switch (job.job_key) {
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
          listing_updated: nextProgress.listing_updated,
          page_backfill_updated: nextProgress.page_backfill_updated,
          global_backfill_updated: nextProgress.global_backfill_updated,
        };
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
    } else {
      await updatePostDeployJobProgress(db, job.job_key, nextProgress);
      log("info", "post_deploy_job_progress", { job_key: job.job_key, progress: nextProgress });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await notePostDeployJobError(db, job.job_key, message, progress);
    log("warn", "post_deploy_job_step_failed", { job_key: job.job_key, message });
  }
}
