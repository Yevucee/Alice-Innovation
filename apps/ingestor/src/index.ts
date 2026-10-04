import { closePool, getPool, markInterruptedIngestionRuns } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { runPostIngestMaintenance } from "./post-ingest.js";
import { resetSupplementalFetchHostPolicy } from "./enrichment-context-fetch.js";
import { resetRunFailureTracker } from "./run-failure-tracker.js";
import { runIngestion } from "./pipeline.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-ingestor";

const ingestProcessStartedAt = new Date();

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

async function main(): Promise<void> {
  const pool = getPool();
  const interrupted = await markInterruptedIngestionRuns(pool, ingestProcessStartedAt);
  if (interrupted > 0) {
    log("info", "ingestion_runs_interrupted", { count: interrupted });
  }
  const only = argValues("--source");
  const previewEnv = process.env.INGEST_SOURCE_PREVIEW_SLUG?.trim();
  if (previewEnv && only.length === 0) {
    only.push(previewEnv);
  }
  const dueOnly = process.argv.includes("--due") || (only.length === 0 && !previewEnv);
  const full = process.argv.includes("--full");
  const dryRun = process.argv.includes("--dry-run") || Boolean(previewEnv);
  const limit = argNumber("--limit") ?? (previewEnv ? Number(process.env.INGEST_SOURCE_PREVIEW_LIMIT ?? "20") : null);
  const sources = loadSources();
  resetSupplementalFetchHostPolicy();
  resetRunFailureTracker();
  log("info", "ingest_start", { due_only: dueOnly, full, dry_run: dryRun, limit, sources: only });
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
      await runPostIngestMaintenance(getPool(), { touchedResourceIds: result.touchedResourceIds });
    } catch (error) {
      log("warn", "post_ingest_maintenance_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
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
