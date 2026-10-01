import { runQualityAudit } from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";
import { runPostIngestEmbeddingBackfill } from "./embedding-backfill.js";
import { enrichMaxPerRun, runEnrichmentBackfill } from "./enrich.js";

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
  if (qualityAuditOnIngestEnabled()) {
    try {
      const summary = await runQualityAudit(db, {
        resourceIds: input.touchedResourceIds.length > 0 ? input.touchedResourceIds : null,
        limit: 5000,
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

  if (enrichBackfillOnIngestEnabled()) {
    try {
      const summary = await runEnrichmentBackfill(db, {
        limit: enrichMaxPerRun(),
        resourceIds: input.touchedResourceIds.length > 0 ? input.touchedResourceIds : null,
      });
      log("info", "post_ingest_enrichment_backfill", summary);
    } catch (error) {
      log("warn", "post_ingest_enrichment_backfill_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    log("info", "post_ingest_enrichment_backfill_skipped", { reason: "ENRICH_BACKFILL_ON_INGEST=false" });
  }

  try {
    await runPostIngestEmbeddingBackfill(db);
  } catch (error) {
    log("warn", "backfill_embeddings_unexpected_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
