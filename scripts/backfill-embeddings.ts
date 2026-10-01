import {
  buildEmbeddingText,
  closePool,
  countActiveResources,
  embeddingTextContentHash,
  getPool,
  loadResourcesForEmbedding,
  saveEmbedding,
} from "@alice/database";
import {
  estimateEmbeddingCostUsd,
  loadDotEnv,
  log,
} from "@alice/shared";
import {
  embedTextsDetailed,
  embeddingSettings,
  embeddingVersion,
} from "@alice/shared";

loadDotEnv();

const DEFAULT_BATCH = 32;
const MAX_CONSECUTIVE_ERRORS = 5;

function parseArgs(argv: string[]) {
  let batchSize = DEFAULT_BATCH;
  let limit: number | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--batch-size" && argv[i + 1]) {
      batchSize = Math.max(1, Number(argv[++i]));
    } else if (arg === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[++i]));
    }
  }
  return { batchSize, limit, dryRun };
}

async function main(): Promise<void> {
  const { batchSize, limit, dryRun } = parseArgs(process.argv.slice(2));
  const settings = embeddingSettings();
  if (!settings.apiKey && !dryRun) {
    throw new Error("EMBEDDING_API_KEY is not set");
  }

  const pool = getPool();
  const totalActive = await countActiveResources(pool);
  const targetTotal = limit ?? totalActive;
  const version = embeddingVersion(settings);

  let offset = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let embedded = 0;
  let totalTokens = 0;
  let consecutiveErrors = 0;
  const started = Date.now();

  log("info", "backfill_embeddings_start", {
    batch_size: batchSize,
    limit,
    dry_run: dryRun,
    model: settings.model,
    dimensions: settings.dimensions,
    active_resources: totalActive,
  });

  while (processed < targetTotal) {
    const fetchSize = Math.min(batchSize, targetTotal - processed);
    const batch = await loadResourcesForEmbedding(pool, fetchSize, offset);
    if (batch.length === 0) break;

    const pending = batch
      .map((row) => {
        const text = buildEmbeddingText({
          canonical_title: row.canonical_title,
          source_summary: row.source_summary,
          extracted_index_text: row.extracted_index_text,
          primary_country_name: row.primary_country_name,
          countries: row.countries,
          problems: row.problems,
          sectors: row.sectors,
          technologies: row.technologies,
          interpretation_problem_statement: row.interpretation_problem_statement,
        });
        const hash = embeddingTextContentHash(text);
        return { row, text, hash };
      })
      .filter((item) => item.row.embedding_content_hash !== item.hash);

    const skipInBatch = batch.length - pending.length;
    skipped += skipInBatch;
    processed += batch.length;
    offset += batch.length;

    if (pending.length === 0) {
      logProgress(processed, targetTotal, skipped, embedded, failed, totalTokens, started);
      if (processed >= targetTotal) break;
      continue;
    }

    if (dryRun) {
      embedded += pending.length;
      log("info", "backfill_embeddings_dry_run_batch", {
        would_embed: pending.length,
        sample_id: pending[0]?.row.id,
        sample_chars: pending[0]?.text.length,
      });
      logProgress(processed, targetTotal, skipped, embedded, failed, totalTokens, started);
      continue;
    }

    const result = await embedTextsDetailed(pending.map((item) => item.text), { maxAttempts: 4 });
    if (result.usage) {
      totalTokens += result.usage.total_tokens;
    }

    if (!result.vectors || result.vectors.length !== pending.length) {
      failed += pending.length;
      consecutiveErrors += 1;
      log("warn", "backfill_embeddings_batch_failed", {
        status: result.status,
        retryable: result.retryable,
        consecutive_errors: consecutiveErrors,
      });
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(`Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive embedding API failures`);
      }
      logProgress(processed, targetTotal, skipped, embedded, failed, totalTokens, started);
      continue;
    }

    consecutiveErrors = 0;
    for (let i = 0; i < pending.length; i += 1) {
      const vector = result.vectors[i];
      const item = pending[i];
      if (!vector || vector.length !== 1536) {
        failed += 1;
        log("warn", "backfill_embeddings_bad_vector", {
          resource_id: item.row.id,
          length: vector?.length ?? 0,
        });
        continue;
      }
      await saveEmbedding(
        pool,
        item.row.id,
        vector,
        settings.model,
        version,
        item.hash,
      );
      embedded += 1;
    }

    logProgress(processed, targetTotal, skipped, embedded, failed, totalTokens, started);
  }

  const costUsd = estimateEmbeddingCostUsd(totalTokens);
  log("info", "backfill_embeddings_complete", {
    processed,
    skipped,
    embedded,
    failed,
    total_tokens: totalTokens,
    estimated_cost_usd: Number(costUsd.toFixed(4)),
  });
  await closePool();
}

function logProgress(
  processed: number,
  targetTotal: number,
  skipped: number,
  embedded: number,
  failed: number,
  totalTokens: number,
  started: number,
): void {
  const elapsedSec = (Date.now() - started) / 1000;
  const rate = processed > 0 ? processed / elapsedSec : 0;
  const remaining = Math.max(0, targetTotal - processed);
  const etaSec = rate > 0 ? remaining / rate : null;
  log("info", "backfill_embeddings_progress", {
    processed,
    target: targetTotal,
    skipped,
    embedded,
    failed,
    total_tokens: totalTokens,
    eta_seconds: etaSec == null ? null : Math.round(etaSec),
  });
}

main().catch((error: unknown) => {
  log("error", "backfill_embeddings_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
