import {
  embeddingAdminStatus,
  recordEmbeddingBackfillRun,
  runEmbeddingBackfill,
  runEmbeddingBackfillForResourceIds,
  runEmbeddingSafetyCheck,
  type EmbeddingBackfillSummary,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import {
  embedTextsDetailed,
  embeddingSettings,
  embeddingVersion,
  log,
} from "@alice/shared";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

function envNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function embeddingBackfillOnIngestEnabled(): boolean {
  return envFlag("EMBEDDING_BACKFILL_ON_INGEST", true);
}

export function embeddingBackfillMaxPerRun(): number {
  return envNumber("EMBEDDING_BACKFILL_MAX_PER_RUN", 20000);
}

export async function runPostIngestEmbeddingBackfill(
  db: Queryable,
  input?: { priorityResourceIds?: string[] },
): Promise<void> {
  if (!embeddingBackfillOnIngestEnabled()) {
    log("info", "backfill_embeddings_skipped", { reason: "EMBEDDING_BACKFILL_ON_INGEST=false" });
    return;
  }

  const settings = embeddingSettings();
  if (!settings.apiKey) {
    log("warn", "backfill_embeddings_skipped", { reason: "EMBEDDING_API_KEY not set" });
    return;
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

  const priorityIds = [...new Set(input?.priorityResourceIds ?? [])];
  let priorityEmbedded = 0;
  let priorityFailed = 0;
  let priorityTokens = 0;

  if (priorityIds.length > 0) {
    log("info", "backfill_embeddings_priority_start", { count: priorityIds.length });
    try {
      const priority = await runEmbeddingBackfillForResourceIds(db, priorityIds, {
        embedBatch,
        model: settings.model,
        version,
        throwOnConsecutiveFailures: false,
      });
      priorityEmbedded = priority.embedded;
      priorityFailed = priority.failed;
      priorityTokens = priority.total_tokens;
      log("info", "backfill_embeddings_priority_complete", priority);
    } catch (error) {
      log("warn", "backfill_embeddings_priority_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log("info", "backfill_embeddings_safety_check_start", {
    model: settings.model,
    dimensions: settings.dimensions,
    base_url: settings.baseUrl,
  });

  const safety = await runEmbeddingSafetyCheck(
    db,
    { embedBatch, model: settings.model, version },
    10,
  );

  let summary: EmbeddingBackfillSummary;
  if (!safety.ok) {
    summary = {
      processed: priorityIds.length,
      skipped: 0,
      embedded: priorityEmbedded,
      failed: priorityFailed,
      total_tokens: priorityTokens,
      estimated_cost_usd: Number(((priorityTokens / 1_000_000) * 0.02).toFixed(4)),
      pct_embedded: (await embeddingAdminStatus(db)).coverage.pct,
      safety_check_passed: false,
      aborted: priorityEmbedded === 0,
      note: `priority_reembedded=${priorityEmbedded}; safety_failed=${safety.detail}`,
    };
    await recordEmbeddingBackfillRun(db, summary);
    log("error", "backfill_embeddings_safety_check_failed", { detail: safety.detail, priority_embedded: priorityEmbedded });
    log("info", "backfill_embeddings_complete", {
      embedded: summary.embedded,
      skipped: summary.skipped,
      failed: summary.failed,
      total_tokens: summary.total_tokens,
      estimated_cost_usd: summary.estimated_cost_usd,
      pct_embedded: summary.pct_embedded,
      safety_check_passed: summary.safety_check_passed,
      aborted: summary.aborted,
      priority_embedded: priorityEmbedded,
      note: summary.note,
    });
    return;
  }

  log("info", "backfill_embeddings_start", {
    max_per_run: embeddingBackfillMaxPerRun(),
    model: settings.model,
    safety: safety.detail,
    priority_ids: priorityIds.length,
  });

  try {
    summary = await runEmbeddingBackfill(db, {
      limit: embeddingBackfillMaxPerRun(),
      batchSize: 32,
      throwOnConsecutiveFailures: false,
      embedBatch,
      model: settings.model,
      version,
      onProgress: (progress) => log("info", "backfill_embeddings_progress", progress),
    });
    summary.safety_check_passed = true;
  } catch (error) {
    summary = {
      processed: 0,
      skipped: 0,
      embedded: 0,
      failed: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      pct_embedded: 0,
      safety_check_passed: true,
      aborted: true,
      note: error instanceof Error ? error.message : String(error),
    };
    log("error", "backfill_embeddings_failed", { message: summary.note });
  }

  summary.embedded += priorityEmbedded;
  summary.failed += priorityFailed;
  summary.total_tokens += priorityTokens;
  summary.estimated_cost_usd = Number(((summary.total_tokens / 1_000_000) * 0.02).toFixed(4));
  summary.note = summary.note
    ? `${summary.note}; priority_reembedded=${priorityEmbedded}`
    : `priority_reembedded=${priorityEmbedded}`;

  try {
    await recordEmbeddingBackfillRun(db, summary);
  } catch (error) {
    log("warn", "backfill_embeddings_record_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  log("info", "backfill_embeddings_complete", {
    embedded: summary.embedded,
    skipped: summary.skipped,
    failed: summary.failed,
    total_tokens: summary.total_tokens,
    estimated_cost_usd: summary.estimated_cost_usd,
    pct_embedded: summary.pct_embedded,
    safety_check_passed: summary.safety_check_passed,
    aborted: summary.aborted,
    priority_embedded: priorityEmbedded,
  });
}
