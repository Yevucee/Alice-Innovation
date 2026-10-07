import {
  closePool,
  getPool,
  loadPromotedSourceRecords,
  markInterruptedIngestionRuns,
  resetStalePostDeployJobs,
} from "@alice/database";
import {
  completeQualityReviewBacklogRun,
  sampleNeedsReviewBySources,
  startQualityReviewBacklogRun,
} from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import type { SourceRecord } from "@alice/source-registry";
import { runPostIngestMaintenance } from "./post-ingest.js";
import { runPostDeployJobsStep, shouldRunPostDeployBeforeIngest } from "./post-deploy-jobs.js";
import { resetSupplementalFetchHostPolicy } from "./enrichment-context-fetch.js";
import { resetRunFailureTracker } from "./run-failure-tracker.js";
import { runIngestion } from "./pipeline.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-ingestor";

const ingestProcessStartedAt = new Date();

function mergeSourceRegistry(registry: SourceRecord[], promoted: SourceRecord[]): SourceRecord[] {
  const byId = new Map(registry.map((source) => [source.id, source]));
  for (const source of promoted) byId.set(source.id, source);
  return [...byId.values()];
}

function argValues(flag: string): string[] {
  const values: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) values.push(argv[++i]);
  }
  return values;
}

function argNumber(flag: string): number | null {
  const value = argValues(flag)[0];
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function finishBacklogRun(
  db: ReturnType<typeof getPool>,
  input: {
    backlogRunId: string;
    postDeploySummary: Awaited<ReturnType<typeof runPostDeployJobsStep>> | null;
  },
): Promise<void> {
  if (!input.backlogRunId) return;
  const sample_report = await sampleNeedsReviewBySources(db, [
    "mit-solve",
    "atlas-of-the-future",
    "solar-impulse",
  ], 10);
  const cleared = input.postDeploySummary?.reconcile_cleared ?? 0;
  const source_limited = input.postDeploySummary?.reconcile_source_limited ?? 0;
  const still_flagged = input.postDeploySummary?.reconcile_still_flagged ?? 0;
  const runRow = await db.query<{ before: number }>(
    `SELECT needs_review_before AS before FROM quality_review_backlog_runs WHERE id = $1::uuid`,
    [input.backlogRunId],
  );
  const before = Number(runRow.rows[0]?.before ?? 0);
  const afterRow = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM resources WHERE active AND review_status = 'NEEDS_REVIEW'`,
  );
  const after = Number(afterRow.rows[0]?.count ?? 0);
  const newly_flagged = Math.max(0, after - before + cleared + source_limited);
  await completeQualityReviewBacklogRun(db, {
    id: input.backlogRunId,
    cleared,
    source_limited,
    still_flagged,
    newly_flagged,
    sample_report,
  });
  log("info", "quality_review_backlog_run_complete", {
    needs_review_before: before,
    needs_review_after: after,
    cleared,
    source_limited,
    still_flagged,
    newly_flagged,
    net_change: after - before,
  });
}

async function main(): Promise<void> {
  const pool = getPool();
  const interrupted = await markInterruptedIngestionRuns(pool, ingestProcessStartedAt);
  if (interrupted > 0) {
    log("info", "ingestion_runs_interrupted", { count: interrupted });
  }
  const resetJobs = await resetStalePostDeployJobs(pool, ingestProcessStartedAt);
  if (resetJobs > 0) {
    log("info", "post_deploy_jobs_reset_stale", { count: resetJobs });
  }
  const only = argValues("--source");
  const previewEnv = process.env.INGEST_SOURCE_PREVIEW_SLUG?.trim();
  if (previewEnv && only.length === 0) {
    only.push(previewEnv);
  }
  const cleanupOnly = process.argv.includes("--cleanup-only");
  const dueOnly = process.argv.includes("--due") || (only.length === 0 && !previewEnv && !cleanupOnly);
  const full = process.argv.includes("--full");
  const dryRun = process.argv.includes("--dry-run") || Boolean(previewEnv);
  const limit = argNumber("--limit") ?? (previewEnv ? Number(process.env.INGEST_SOURCE_PREVIEW_LIMIT ?? "20") : null);
  const registrySources = loadSources();
  const promotedSources = await loadPromotedSourceRecords(pool).catch(() => [] as SourceRecord[]);
  const sources = mergeSourceRegistry(registrySources, promotedSources);
  resetSupplementalFetchHostPolicy();
  resetRunFailureTracker();

  log("info", "ingest_start", {
    due_only: dueOnly,
    full,
    dry_run: dryRun,
    cleanup_only: cleanupOnly,
    limit,
    sources: only,
  });

  let skipPostDeploy = false;
  let postDeploySummary: Awaited<ReturnType<typeof runPostDeployJobsStep>> | null = null;
  let backlogRunId = "";

  if (!dryRun) {
    const started = await startQualityReviewBacklogRun(
      pool,
      cleanupOnly ? "cleanup_only" : "ingest_run",
    );
    backlogRunId = started.id;
  }

  if (!dryRun && (cleanupOnly || await shouldRunPostDeployBeforeIngest(pool, { cleanupOnly }))) {
    log("info", "post_deploy_before_ingest", {
      reason: cleanupOnly ? "cleanup_only" : "manual_or_pending_jobs",
    });
    try {
      postDeploySummary = await runPostDeployJobsStep(pool, {
        trigger: cleanupOnly ? "cleanup_only" : "before_ingest",
      });
      skipPostDeploy = true;
    } catch (error) {
      log("error", "post_deploy_before_ingest_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (cleanupOnly) {
    if (!dryRun) {
      try {
        await runPostIngestMaintenance(pool, {
          touchedResourceIds: [],
          skipPostDeploy,
        });
      } catch (error) {
        log("warn", "post_ingest_maintenance_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      await finishBacklogRun(pool, { backlogRunId, postDeploySummary });
    }
    await closePool();
    return;
  }

  const result = await runIngestion({
    sources,
    only,
    dueOnly: only.length === 0 ? dueOnly : false,
    limit,
    full,
    dryRun,
    collectSourcePreview: dryRun && only.length === 1,
  });
  if (result.sourcePreviewReport) {
    const { persistSourcePreviewReport } = await import("./source-preview.js");
    await persistSourcePreviewReport(pool, result.sourcePreviewReport);
  }
  if (result.failedSources.length) {
    log("warn", "ingest_finished_with_source_failures", { sources: result.failedSources });
  } else {
    log("info", "ingest_finished", { touched_resources: result.touchedResourceIds.length });
  }
  if (result.ingestSkippedDueToLock) {
    log("info", "post_ingest_skipped", { reason: "ingest_lock_held" });
  } else if (!dryRun) {
    try {
      if (!skipPostDeploy) {
        postDeploySummary = await runPostDeployJobsStep(pool, { trigger: "post_ingest" });
      }
      await runPostIngestMaintenance(pool, {
        touchedResourceIds: result.touchedResourceIds,
        skipPostDeploy: true,
      });
    } catch (error) {
      log("warn", "post_ingest_maintenance_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (!dryRun && backlogRunId) {
    await finishBacklogRun(pool, { backlogRunId, postDeploySummary });
  }
  await closePool();
}

main().catch(async (error: unknown) => {
  log("error", "ingest_crashed", { message: error instanceof Error ? error.message : String(error) });
  try {
    await getPool().end();
  } catch {
    // Pool may never have opened.
  }
  process.exitCode = 1;
});
