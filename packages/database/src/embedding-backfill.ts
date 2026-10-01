import type { Queryable } from "./pool.js";
import {
  buildEmbeddingText,
  countActiveResources,
  embeddingCatalogueCoverage,
  embeddingTextContentHash,
  loadResourcesForEmbedding,
  loadResourcesForEmbeddingByIds,
} from "./embedding-text.js";
import { saveEmbedding } from "./ingest.js";

export interface EmbeddingBackfillSummary {
  processed: number;
  skipped: number;
  embedded: number;
  failed: number;
  total_tokens: number;
  estimated_cost_usd: number;
  pct_embedded: number;
  safety_check_passed: boolean;
  aborted: boolean;
  note: string;
}

export interface EmbeddingBackfillRunOptions {
  limit?: number | null;
  batchSize?: number;
  dryRun?: boolean;
  maxConsecutiveErrors?: number;
  /** When false, log and return instead of throwing after consecutive API failures. */
  throwOnConsecutiveFailures?: boolean;
  embedBatch: (texts: string[]) => Promise<{
    vectors: number[][] | null;
    usage?: { total_tokens: number };
    status?: number;
    retryable?: boolean;
  }>;
  model: string;
  version: string;
  onProgress?: (progress: Record<string, unknown>) => void;
}

const DEFAULT_BATCH = 32;
const DEFAULT_MAX_CONSECUTIVE = 5;

export async function recordEmbeddingBackfillRun(
  db: Queryable,
  summary: EmbeddingBackfillSummary,
): Promise<void> {
  await db.query(
    `INSERT INTO embedding_backfill_runs (
       embedded, skipped, failed, processed, total_tokens, estimated_cost_usd,
       pct_embedded, safety_check_passed, aborted, note
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      summary.embedded,
      summary.skipped,
      summary.failed,
      summary.processed,
      summary.total_tokens,
      summary.estimated_cost_usd,
      summary.pct_embedded,
      summary.safety_check_passed,
      summary.aborted,
      summary.note,
    ],
  );
}

export async function latestEmbeddingBackfillRun(
  db: Queryable,
): Promise<Record<string, unknown> | null> {
  const row = await db.query(
    `SELECT id::text, completed_at, embedded, skipped, failed, processed,
            total_tokens, estimated_cost_usd, pct_embedded,
            safety_check_passed, aborted, note
     FROM embedding_backfill_runs
     ORDER BY completed_at DESC
     LIMIT 1`,
  );
  return row.rows[0] ?? null;
}

export async function embeddingAdminStatus(db: Queryable): Promise<{
  coverage: { active: number; with_embedding: number; pct: number };
  last_run: Record<string, unknown> | null;
}> {
  const coverage = await embeddingCatalogueCoverage(db);
  const lastRun = await latestEmbeddingBackfillRun(db);
  return { coverage, last_run: lastRun };
}

export async function verifyEmbeddingSafetySample(
  db: Queryable,
  expectedModel: string,
  expectedDimensions: number,
  sampleSize = 10,
): Promise<{ ok: boolean; detail: string }> {
  const row = await db.query<{ id: string; dims: number | null; model: string | null }>(
    `SELECT id::text,
            vector_dims(embedding) AS dims,
            embedding_model AS model
     FROM resources
     WHERE embedding IS NOT NULL
     ORDER BY embedded_at DESC NULLS LAST
     LIMIT $1`,
    [sampleSize],
  );
  if (row.rows.length === 0) {
    return { ok: false, detail: "No embedded resources found after safety sample" };
  }
  for (const sample of row.rows) {
    if (sample.dims !== expectedDimensions) {
      return {
        ok: false,
        detail: `Resource ${sample.id} has vector_dims=${sample.dims}, expected ${expectedDimensions}`,
      };
    }
    if (sample.model !== expectedModel) {
      return {
        ok: false,
        detail: `Resource ${sample.id} has embedding_model=${sample.model ?? "null"}, expected ${expectedModel}`,
      };
    }
  }
  return { ok: true, detail: `Verified ${row.rows.length} recent embeddings` };
}

export async function runEmbeddingSafetyCheck(
  db: Queryable,
  options: Pick<EmbeddingBackfillRunOptions, "embedBatch" | "model" | "version">,
  sampleSize = 10,
): Promise<{ ok: boolean; detail: string }> {
  const batch = await loadResourcesForEmbedding(db, sampleSize, 0);
  if (batch.length === 0) {
    return { ok: false, detail: "No active resources available for embedding safety check" };
  }
  const pending = batch.slice(0, sampleSize).map((row) => {
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
    return { row, text, hash: embeddingTextContentHash(text) };
  });

  const result = await options.embedBatch(pending.map((item) => item.text));
  if (!result.vectors || result.vectors.length !== pending.length) {
    return {
      ok: false,
      detail: `Safety embed API failed (status=${result.status ?? "unknown"})`,
    };
  }

  for (let i = 0; i < pending.length; i += 1) {
    const vector = result.vectors[i];
    if (!vector || vector.length !== 1536) {
      return {
        ok: false,
        detail: `Safety sample vector length ${vector?.length ?? 0}, expected 1536`,
      };
    }
    await saveEmbedding(
      db,
      pending[i].row.id,
      vector,
      options.model,
      options.version,
      pending[i].hash,
    );
  }

  return verifyEmbeddingSafetySample(db, options.model, 1536, Math.min(sampleSize, pending.length));
}

async function embedResourceRows(
  db: Queryable,
  rows: Awaited<ReturnType<typeof loadResourcesForEmbedding>>,
  options: Pick<
    EmbeddingBackfillRunOptions,
    "embedBatch" | "model" | "version" | "dryRun" | "maxConsecutiveErrors" | "throwOnConsecutiveFailures"
  >,
): Promise<{ embedded: number; skipped: number; failed: number; total_tokens: number; aborted: boolean; note: string }> {
  const batchSize = DEFAULT_BATCH;
  const maxConsecutive = options.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE;
  const throwOnFailures = options.throwOnConsecutiveFailures ?? true;
  const dryRun = options.dryRun ?? false;
  let skipped = 0;
  let failed = 0;
  let embedded = 0;
  let totalTokens = 0;
  let consecutiveErrors = 0;
  let aborted = false;
  let note = "";

  const pendingAll = rows
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

  skipped += rows.length - pendingAll.length;

  for (let offset = 0; offset < pendingAll.length; offset += batchSize) {
    const pending = pendingAll.slice(offset, offset + batchSize);
    if (pending.length === 0) continue;
    if (dryRun) {
      embedded += pending.length;
      continue;
    }
    const result = await options.embedBatch(pending.map((item) => item.text));
    if (result.usage?.total_tokens) totalTokens += result.usage.total_tokens;
    if (!result.vectors || result.vectors.length !== pending.length) {
      failed += pending.length;
      consecutiveErrors += 1;
      if (consecutiveErrors >= maxConsecutive) {
        aborted = true;
        note = `Stopped after ${maxConsecutive} consecutive embedding API failures`;
        if (throwOnFailures) throw new Error(note);
        break;
      }
      continue;
    }
    consecutiveErrors = 0;
    for (let i = 0; i < pending.length; i += 1) {
      const vector = result.vectors[i];
      const item = pending[i];
      if (!vector || vector.length !== 1536) {
        failed += 1;
        continue;
      }
      await saveEmbedding(db, item.row.id, vector, options.model, options.version, item.hash);
      embedded += 1;
    }
  }

  return { embedded, skipped, failed, total_tokens: totalTokens, aborted, note };
}

export async function runEmbeddingBackfillForResourceIds(
  db: Queryable,
  resourceIds: string[],
  options: Pick<
    EmbeddingBackfillRunOptions,
    "embedBatch" | "model" | "version" | "dryRun" | "maxConsecutiveErrors" | "throwOnConsecutiveFailures"
  >,
): Promise<{ embedded: number; skipped: number; failed: number; total_tokens: number }> {
  if (resourceIds.length === 0) {
    return { embedded: 0, skipped: 0, failed: 0, total_tokens: 0 };
  }
  const rows = await loadResourcesForEmbeddingByIds(db, resourceIds);
  const result = await embedResourceRows(db, rows, options);
  return {
    embedded: result.embedded,
    skipped: result.skipped,
    failed: result.failed,
    total_tokens: result.total_tokens,
  };
}

export async function runEmbeddingBackfill(
  db: Queryable,
  options: EmbeddingBackfillRunOptions,
): Promise<EmbeddingBackfillSummary> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const maxConsecutive = options.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE;
  const throwOnFailures = options.throwOnConsecutiveFailures ?? true;
  const dryRun = options.dryRun ?? false;

  const totalActive = await countActiveResources(db);
  const maxPerRun = options.limit ?? totalActive;
  const targetTotal = Math.min(maxPerRun, totalActive);

  let offset = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let embedded = 0;
  let totalTokens = 0;
  let consecutiveErrors = 0;
  let aborted = false;
  let note = "";
  const started = Date.now();

  while (processed < targetTotal) {
    const fetchSize = Math.min(batchSize, targetTotal - processed);
    const batch = await loadResourcesForEmbedding(db, fetchSize, offset);
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

    skipped += batch.length - pending.length;
    processed += batch.length;
    offset += batch.length;

    if (pending.length === 0) {
      options.onProgress?.({
        processed,
        target: targetTotal,
        skipped,
        embedded,
        failed,
        total_tokens: totalTokens,
        eta_seconds: etaSeconds(processed, targetTotal, started),
      });
      continue;
    }

    if (dryRun) {
      embedded += pending.length;
      continue;
    }

    const result = await options.embedBatch(pending.map((item) => item.text));
    if (result.usage?.total_tokens) {
      totalTokens += result.usage.total_tokens;
    }

    if (!result.vectors || result.vectors.length !== pending.length) {
      failed += pending.length;
      consecutiveErrors += 1;
      if (consecutiveErrors >= maxConsecutive) {
        aborted = true;
        note = `Stopped after ${maxConsecutive} consecutive embedding API failures`;
        if (throwOnFailures) {
          throw new Error(note);
        }
        break;
      }
      continue;
    }

    consecutiveErrors = 0;
    for (let i = 0; i < pending.length; i += 1) {
      const vector = result.vectors[i];
      const item = pending[i];
      if (!vector || vector.length !== 1536) {
        failed += 1;
        continue;
      }
      await saveEmbedding(db, item.row.id, vector, options.model, options.version, item.hash);
      embedded += 1;
    }

    options.onProgress?.({
      processed,
      target: targetTotal,
      skipped,
      embedded,
      failed,
      total_tokens: totalTokens,
      eta_seconds: etaSeconds(processed, targetTotal, started),
    });
  }

  const coverage = await embeddingCatalogueCoverage(db);
  const costUsd = (totalTokens / 1_000_000) * 0.02;
  return {
    processed,
    skipped,
    embedded,
    failed,
    total_tokens: totalTokens,
    estimated_cost_usd: Number(costUsd.toFixed(4)),
    pct_embedded: coverage.pct,
    safety_check_passed: true,
    aborted,
    note,
  };
}

function etaSeconds(processed: number, targetTotal: number, started: number): number | null {
  const elapsedSec = (Date.now() - started) / 1000;
  const rate = processed > 0 ? processed / elapsedSec : 0;
  if (rate <= 0) return null;
  return Math.round(Math.max(0, targetTotal - processed) / rate);
}
