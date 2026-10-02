import { runQualityAudit } from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";
import { runPostIngestCatalogueRepairs, resolvePriorityReembedResourceIds } from "./catalogue-repair.js";
import { runPostIngestEmbeddingBackfill } from "./embedding-backfill.js";
import { enrichMaxPerRun, runEnrichmentBackfill } from "./enrich.js";
import { runPostIngestImageBackfill } from "./image-backfill.js";
import { runPostDeployJobsStep } from "./post-deploy-jobs.js";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

export function qualityAuditOnIngestEnabled(): boolean {
  return envFlag("QUALITY_AUDIT_ON_INGEST", true);
}

export function enrichBackfillOnIngestEnabled(): boolean {
  return envFlag("ENRICH_BACKFILL_ON_INGEST", true);
}

export async function runPostIngestMaintenance(
  db: Queryable,
  input: { touchedResourceIds: string[] },
): Promise<void> {
  try {
    await runPostDeployJobsStep(db);
  } catch (error) {
    log("warn", "post_deploy_jobs_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await runPostIngestImageBackfill(db, input.touchedResourceIds);
  } catch (error) {
    log("warn", "post_ingest_image_backfill_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let catalogueNote = "";
  try {
    const repairs = await runPostIngestCatalogueRepairs(db);
    catalogueNote = `org_merge_removed=${repairs.org_merge_removed}; org_merge_groups=${repairs.org_merge_groups}`;
  } catch (error) {
    log("warn", "post_ingest_catalogue_repairs_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (qualityAuditOnIngestEnabled()) {
    try {
      const summary = await runQualityAudit(db, {
        resourceIds: null,
        limit: null,
        dryRun: false,
        apply: true,
      });
      log("info", "post_ingest_quality_audit", {
        scanned: summary.scanned,
        flagged: summary.flagged,
        reason_counts: summary.reason_counts,
      });
    } catch (error) {
      log("warn", "post_ingest_quality_audit_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    log("info", "post_ingest_quality_audit_skipped", { reason: "QUALITY_AUDIT_ON_INGEST=false" });
  }

  let enrichedResourceIds: string[] = [];
  if (enrichBackfillOnIngestEnabled()) {
    try {
      const summary = await runEnrichmentBackfill(db, {
        limit: enrichMaxPerRun(),
        resourceIds: null,
      });
      enrichedResourceIds = summary.enriched_resource_ids;
      log("info", "post_ingest_enrichment_backfill", {
        processed: summary.processed,
        attempted: summary.attempted,
        applied: summary.applied,
        no_data: summary.no_data,
        enriched: summary.enriched,
        skipped: summary.skipped,
        failed: summary.failed,
        total_tokens: summary.total_tokens,
        estimated_cost_usd: summary.estimated_cost_usd,
        paused_budget: summary.paused_budget,
        time_budget_exhausted: summary.time_budget_exhausted,
        array_unwraps: summary.array_unwraps,
      });
    } catch (error) {
      log("warn", "post_ingest_enrichment_backfill_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    log("info", "post_ingest_enrichment_backfill_skipped", { reason: "ENRICH_BACKFILL_ON_INGEST=false" });
  }

  try {
    const queue = await resolvePriorityReembedResourceIds(db, enrichedResourceIds);
    await runPostIngestEmbeddingBackfill(db, {
      priorityResourceIds: queue.ids,
      priorityQueued: queue.ids.length,
      catalogueRepairNote: catalogueNote,
      reembedQueueMeta: queue,
    });
  } catch (error) {
    log("warn", "backfill_embeddings_unexpected_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
