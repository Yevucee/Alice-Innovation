import {
  runEmbeddingBackfillForResourceIds,
  runNeedsReviewReconcileBatch,
  type Queryable,
} from "@alice/database";
import { embedTextsDetailed, embeddingSettings, embeddingVersion, log } from "@alice/shared";

export async function runNeedsReviewReconcileJobBatch(
  db: Queryable,
  offset: number,
): Promise<{
  scanned: number;
  cleared: number;
  source_limited: number;
  still_flagged: number;
  next_offset: number;
  complete: boolean;
  reembed_resource_ids: string[];
}> {
  const batch = await runNeedsReviewReconcileBatch(db, offset);
  log("info", "needs_review_reconcile_batch", {
    scanned: batch.scanned,
    cleared: batch.cleared,
    source_limited: batch.source_limited,
    still_flagged: batch.still_flagged,
    offset: batch.offset,
  });
  return {
    scanned: batch.scanned,
    cleared: batch.cleared,
    source_limited: batch.source_limited,
    still_flagged: batch.still_flagged,
    next_offset: batch.next_offset,
    complete: batch.complete,
    reembed_resource_ids: batch.reembed_resource_ids,
  };
}

export async function reembedReconcileBatch(
  db: Queryable,
  resourceIds: string[],
): Promise<number> {
  if (resourceIds.length === 0) return 0;
  const settings = embeddingSettings();
  if (!settings.apiKey) return 0;
  const version = embeddingVersion(settings);
  const summary = await runEmbeddingBackfillForResourceIds(db, resourceIds, {
    version,
    model: settings.model,
    embedBatch: async (texts) => {
      const result = await embedTextsDetailed(texts, { maxAttempts: 4 });
      return {
        vectors: result.vectors,
        usage: result.usage ? { total_tokens: result.usage.total_tokens } : undefined,
        status: result.status,
        retryable: result.retryable,
      };
    },
  });
  return summary.embedded;
}
