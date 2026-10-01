import {
  closePool,
  getPool,
  recordEmbeddingBackfillRun,
  runEmbeddingBackfill,
  runEmbeddingSafetyCheck,
} from "@alice/database";
import {
  embedTextsDetailed,
  embeddingSettings,
  embeddingVersion,
  loadDotEnv,
  log,
} from "@alice/shared";

loadDotEnv();

const DEFAULT_BATCH = 32;

function parseArgs(argv: string[]) {
  let batchSize = DEFAULT_BATCH;
  let limit: number | null = null;
  let dryRun = false;
  let skipSafety = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--skip-safety") skipSafety = true;
    else if (arg === "--batch-size" && argv[i + 1]) {
      batchSize = Math.max(1, Number(argv[++i]));
    } else if (arg === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[++i]));
    }
  }
  return { batchSize, limit, dryRun, skipSafety };
}

async function main(): Promise<void> {
  const { batchSize, limit, dryRun, skipSafety } = parseArgs(process.argv.slice(2));
  const settings = embeddingSettings();
  if (!settings.apiKey && !dryRun) {
    throw new Error("EMBEDDING_API_KEY is not set");
  }

  const pool = getPool();
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

  if (!skipSafety && !dryRun) {
    log("info", "backfill_embeddings_safety_check_start", { model: settings.model });
    const safety = await runEmbeddingSafetyCheck(
      pool,
      { embedBatch, model: settings.model, version },
      10,
    );
    if (!safety.ok) {
      throw new Error(`Embedding safety check failed: ${safety.detail}`);
    }
    log("info", "backfill_embeddings_safety_check_passed", { detail: safety.detail });
  }

  log("info", "backfill_embeddings_start", {
    batch_size: batchSize,
    limit,
    dry_run: dryRun,
    model: settings.model,
    dimensions: settings.dimensions,
  });

  const summary = await runEmbeddingBackfill(pool, {
    limit,
    batchSize,
    dryRun,
    embedBatch,
    model: settings.model,
    version,
    throwOnConsecutiveFailures: true,
    onProgress: (progress) => log("info", "backfill_embeddings_progress", progress),
  });

  if (!dryRun) {
    await recordEmbeddingBackfillRun(pool, summary);
  }

  log("info", "backfill_embeddings_complete", {
    embedded: summary.embedded,
    skipped: summary.skipped,
    failed: summary.failed,
    total_tokens: summary.total_tokens,
    estimated_cost_usd: summary.estimated_cost_usd,
    pct_embedded: summary.pct_embedded,
  });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "backfill_embeddings_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
