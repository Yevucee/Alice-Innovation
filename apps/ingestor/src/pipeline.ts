import {
  confirmDisappearances,
  getPool,
  ingestDetailBootstrapDays,
  ingestDetailRefetchDays,
  listingContentHash,
  loadSourceItemListingStateMap,
  lookupListingState,
  readCheckpoint,
  shouldSkipDetailFetch,
  touchSourceItemWithoutDetailFetch,
  writeCheckpoint,
} from "@alice/database";
import { canonicaliseUrl, log } from "@alice/shared";
import type { NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import { fetchText, HttpStatusError } from "./http.js";
import { robotsAllows } from "./robots.js";
import { getAdapter, ensurePromotedCatalogueAdapters } from "./adapters/registry.js";
import { AccessBlockedError, type AdapterContext, type DiscoveredRef } from "./adapters/types.js";
import { createHostPacedFetch, ingestDetailConcurrency, mapWithConcurrency } from "./detail-fetch.js";
import { createIngestSourceLoopBudget } from "./ingest-loop-budget.js";
import { processIngestItem } from "./item-pipeline.js";
import { prepareIngestDraft } from "./prepare-draft.js";
import { buildSourcePreviewReport, type SourcePreviewReport } from "./source-preview.js";
import { resolveIngestItemLimit } from "./ingest-limits.js";

const LOCK_KEY = 84261001;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function ingestProgressEvery(): number {
  const parsed = Number(process.env.INGEST_PROGRESS_EVERY ?? "25");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
}

function failureReason(error: unknown): string {
  const status = error instanceof HttpStatusError
    ? error.status
    : error instanceof AccessBlockedError
      ? error.status
      : null;
  const message = error instanceof Error ? error.message : String(error);
  return status != null ? `${status}: ${message}` : message;
}

function due(source: SourceRecord, lastSuccess: Date | null, now = new Date()): boolean {
  if (!source.enabled || source.update_class === "MANUAL") return false;
  if (!lastSuccess) return true;
  const elapsed = now.getTime() - lastSuccess.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (source.update_class === "DAILY") return elapsed >= day;
  if (source.update_class === "WEEKLY") return elapsed >= 7 * day;
  return elapsed >= 30 * day;
}

async function guardRobots(source: SourceRecord, userAgent: string, timeoutMs: number, target: string): Promise<void> {
  const robotsUrl = new URL("/robots.txt", source.homepage).toString();
  try {
    const robots = await fetchText(robotsUrl, { userAgent, timeoutMs, maxAttempts: 1 });
    const path = new URL(target).pathname;
    const decision = robotsAllows(robots.body, userAgent, path);
    if (!decision.allowed) {
      throw new AccessBlockedError(`robots.txt disallows ${path} for ${source.id}`, 403);
    }
  } catch (error) {
    if (error instanceof AccessBlockedError) throw error;
    if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
      throw new AccessBlockedError(`Could not read robots.txt for ${source.id} (${error.status}). Not fetching the catalogue.`, error.status);
    }
    if (error instanceof HttpStatusError && error.status === 404) return;
    throw error;
  }
}

export interface IngestOptions {
  sources: SourceRecord[];
  only?: string[];
  dueOnly: boolean;
  limit: number | null;
  full: boolean;
  dryRun: boolean;
  collectSourcePreview?: boolean;
}

export async function runIngestion(
  options: IngestOptions,
): Promise<{
  failedSources: string[];
  touchedResourceIds: string[];
  ingestSkippedDueToLock: boolean;
  sourcePreviewReport?: import("./source-preview.js").SourcePreviewReport;
}> {
  const pool = getPool();
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const client = await pool.connect();
  const locked = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
  if (!locked.rows[0]?.locked) {
    log("info", "ingest_skipped", { reason: "lock_held" });
    client.release();
    return { failedSources: [], touchedResourceIds: [], ingestSkippedDueToLock: true };
  }

  const failedSources: string[] = [];
  const touchedResourceIds = new Set<string>();
  let previewDrafts: NormalisedDraft[] = [];
  let previewSource: SourceRecord | null = null;
  let previewLimit = options.limit ?? 20;
  const ingestLoopStartedAt = Date.now();
  const sourceLoopBudget = createIngestSourceLoopBudget(ingestLoopStartedAt);
  try {
    await ensurePromotedCatalogueAdapters(pool);
    const selected = options.sources.filter((source) => {
      if (options.only && options.only.length > 0) return options.only.includes(source.id);
      return source.enabled;
    });
    let sourcesStarted = 0;
    for (const source of selected) {
      if (sourceLoopBudget.exhausted()) {
        log("info", "ingest_source_loop_time_budget", {
          max_minutes: sourceLoopBudget.maxMinutes(),
          elapsed_ms: Date.now() - ingestLoopStartedAt,
          sources_started: sourcesStarted,
          sources_remaining: selected.length - sourcesStarted,
        });
        break;
      }
      sourcesStarted += 1;
      const started = Date.now();
      try {
        const meta = await pool.query<{ last_successful_run: Date | null; id: string }>(
          "SELECT id::text, last_successful_run FROM sources WHERE slug = $1",
          [source.id],
        );
        const sourceItemLimit = resolveIngestItemLimit({
          cliLimit: options.limit,
          lastSuccessfulRun: meta.rows[0]?.last_successful_run ?? null,
        });
        if (!meta.rows[0]) {
          log("error", "source_not_seeded", { source_id: source.id });
          failedSources.push(source.id);
          continue;
        }
        if (options.dueOnly && !due(source, meta.rows[0].last_successful_run)) {
          log("info", "source_not_due", { source_id: source.id });
          continue;
        }
        await pool.query("UPDATE sources SET last_attempted_run = now(), updated_at = now() WHERE slug = $1", [source.id]);
        const run = await pool.query<{ id: string }>(
          `INSERT INTO ingestion_runs (source_id, status) VALUES ($1, 'RUNNING') RETURNING id::text`,
          [meta.rows[0].id],
        );
        const runId = run.rows[0].id;
        const counts = {
          discovered: 0,
          fetched: 0,
          created: 0,
          updated: 0,
          unchanged: 0,
          failed: 0,
          duplicates: 0,
          enrich_attempted: 0,
          enrich_applied: 0,
          detail_skipped: 0,
          detail_skipped_bootstrap: 0,
        };
        try {
          const adapter = getAdapter(source.adapter);
          if (!adapter) {
            throw new Error(`No adapter implementation for ${source.adapter}`);
          }
          if (!adapter.skipRobotsGuard) {
            const target = source.collection_url || source.discovery.sitemap || source.homepage;
            await guardRobots(source, userAgent, timeoutMs, target);
          }
          let lastRequest = 0;
          const minInterval = Math.ceil(60000 / Math.max(1, source.limits.requests_per_minute));
          const pacedFetch = async (url: string) => {
            const wait = minInterval - (Date.now() - lastRequest);
            if (wait > 0) await sleep(wait);
            lastRequest = Date.now();
            return fetchText(url, { userAgent, timeoutMs });
          };
          const detailFetch = createHostPacedFetch(source, userAgent, timeoutMs);
          const ctx: AdapterContext = {
            source,
            userAgent,
            timeoutMs,
            limit: sourceItemLimit,
            fetchText: pacedFetch,
          };
          const detailCtx: AdapterContext = {
            ...ctx,
            fetchText: detailFetch,
          };
          let refs = await adapter.discover(ctx);
          counts.discovered = refs.length;
          const checkpoint = options.full ? await readCheckpoint(pool, source.id) : "";
          const catalogue = refs.map((ref) => canonicaliseUrl(ref.url));
          if (checkpoint) refs = refs.filter((ref) => ref.url > checkpoint);
          if (sourceItemLimit !== null) refs = refs.slice(0, sourceItemLimit);
          let cursor = checkpoint;
          const progressEvery = ingestProgressEvery();
          const refetchDays = ingestDetailRefetchDays();
          const bootstrapDays = ingestDetailBootstrapDays();
          const detailConcurrency = ingestDetailConcurrency();
          log("info", "source_started", {
            source_id: source.id,
            run_id: runId,
            discovered: counts.discovered,
            to_process: refs.length,
            full: options.full,
            limit: sourceItemLimit,
            first_run_cap: meta.rows[0]?.last_successful_run == null && options.limit === null,
            detail_refetch_days: refetchDays,
            detail_bootstrap_days: bootstrapDays,
            detail_concurrency: detailConcurrency,
            source_loop_budget_remaining_ms: sourceLoopBudget.remainingMs(),
          });
          let itemsProcessed = 0;
          const listingStateMap = options.dryRun
            ? new Map()
            : await loadSourceItemListingStateMap(pool, source.id);
          const failureSummaries: Array<{ url: string; reason: string }> = [];
          let sourceTimeBudgetExhausted = false;

          const processRef = async (ref: DiscoveredRef): Promise<{ ref: DiscoveredRef; cursor: string }> => {
            const listingHash = listingContentHash(ref);
            if (!options.dryRun) {
              const skip = shouldSkipDetailFetch(
                lookupListingState(listingStateMap, ref),
                listingHash,
                refetchDays,
                bootstrapDays,
              );
              if (skip.skip) {
                const touched = await touchSourceItemWithoutDetailFetch(pool, source.id, ref, runId, listingHash);
                if (touched) {
                  counts.unchanged += 1;
                  counts.detail_skipped += 1;
                  if (skip.reason === "bootstrap") counts.detail_skipped_bootstrap += 1;
                  return { ref, cursor: ref.url };
                }
              }
            }
            const page = await adapter.fetch(ref, detailCtx);
            counts.fetched += 1;
            const parsed = adapter.parse(page);
            const draft = prepareIngestDraft(parsed, source);
            if (options.dryRun) {
              if (options.collectSourcePreview) {
                previewDrafts.push(parsed);
                previewSource = source;
              }
              log("info", "dry_run_item", { source_id: source.id, title: draft.title, url: draft.canonicalUrl });
              return { ref, cursor: ref.url };
            }
            const processed = await processIngestItem(pool, source, parsed, runId, { listingContentHash: listingHash });
            const saved = processed.saved;
            if (saved.outcome === "unchanged") counts.unchanged += 1;
            else if (saved.outcome === "created") counts.created += 1;
            else counts.updated += 1;
            if (processed.steps.includes("enrich")) {
              counts.enrich_attempted += 1;
              counts.enrich_applied += 1;
            } else if (processed.steps.includes("enrich_skipped")) {
              counts.enrich_attempted += 1;
            }
            if (saved.outcome !== "unchanged") {
              touchedResourceIds.add(saved.resourceId);
            }
            return { ref, cursor: ref.url };
          };

          for (let offset = 0; offset < refs.length; offset += detailConcurrency) {
            if (sourceLoopBudget.exhausted()) {
              sourceTimeBudgetExhausted = true;
              log("info", "ingest_source_time_budget", {
                source_id: source.id,
                run_id: runId,
                max_minutes: sourceLoopBudget.maxMinutes(),
                items_processed: itemsProcessed,
                to_process: refs.length,
                elapsed_ms: Date.now() - ingestLoopStartedAt,
              });
              break;
            }
            const chunk = refs.slice(offset, offset + detailConcurrency);
            const chunkResults = await mapWithConcurrency(chunk, chunk.length, async (ref) => {
              try {
                return await processRef(ref);
              } catch (error) {
                counts.failed += 1;
                const reason = failureReason(error);
                failureSummaries.push({ url: ref.url, reason });
                await recordError(source.id, runId, ref, error);
                return { ref, cursor: ref.url };
              }
            });
            for (const result of chunkResults) {
              cursor = result.cursor;
              itemsProcessed += 1;
              if (itemsProcessed % progressEvery === 0) {
                log("info", "ingest_source_progress", {
                  source_id: source.id,
                  run_id: runId,
                  items_processed: itemsProcessed,
                  pages_fetched: counts.fetched,
                  detail_skipped: counts.detail_skipped,
                  detail_skipped_bootstrap: counts.detail_skipped_bootstrap,
                  created: counts.created,
                  updated: counts.updated,
                  unchanged: counts.unchanged,
                  failed: counts.failed,
                  enrich_attempted: counts.enrich_attempted,
                  enrich_applied: counts.enrich_applied,
                  elapsed_ms: Date.now() - started,
                });
              }
            }
            if (options.full && !options.dryRun && chunk.length > 0) {
              await writeCheckpoint(pool, source.id, chunk[chunk.length - 1].url);
            }
          }
          if (failureSummaries.length > 0) {
            log("info", "source_failed_items_summary", {
              source_id: source.id,
              run_id: runId,
              count: failureSummaries.length,
              failures: failureSummaries,
            });
          }
          if (options.full && !options.dryRun && options.limit === null && !checkpoint && adapter.fullCatalogue && !sourceTimeBudgetExhausted) {
            await confirmDisappearances(pool, source.id, catalogue);
          }
          let runErrorSummary: string | null = null;
          if (sourceTimeBudgetExhausted) {
            runErrorSummary = `source_loop_time_budget_minutes=${sourceLoopBudget.maxMinutes()}; items_processed=${itemsProcessed}; to_process=${refs.length}`;
          }
          let status = counts.failed > 0 ? "PARTIAL_SUCCESS" : "SUCCESS";
          if (sourceTimeBudgetExhausted && itemsProcessed < refs.length) {
            status = "PARTIAL_SUCCESS";
          }
          await finishRun(runId, status, counts, Date.now() - started, runErrorSummary);
          if (!sourceTimeBudgetExhausted && (status === "SUCCESS" || counts.created + counts.updated + counts.unchanged > 0)) {
            await pool.query("UPDATE sources SET last_successful_run = now(), updated_at = now() WHERE slug = $1", [source.id]);
          }
          log("info", "source_finished", {
            source_id: source.id,
            run_id: runId,
            ...counts,
            items_processed: itemsProcessed,
            to_process: refs.length,
            source_time_budget_exhausted: sourceTimeBudgetExhausted,
            duration_ms: Date.now() - started,
          });
          if (sourceTimeBudgetExhausted) {
            log("info", "ingest_source_loop_time_budget", {
              max_minutes: sourceLoopBudget.maxMinutes(),
              elapsed_ms: Date.now() - ingestLoopStartedAt,
              stopped_at_source: source.id,
              items_processed: itemsProcessed,
              to_process: refs.length,
            });
            break;
          }
        } catch (error) {
          failedSources.push(source.id);
          const message = error instanceof Error ? error.message : String(error);
          await finishRun(runId, "FAILED", counts, Date.now() - started, message);
          await recordError(source.id, runId, null, error);
          log("error", "source_failed", { source_id: source.id, run_id: runId, message });
        }
      } catch (error) {
        failedSources.push(source.id);
        log("error", "source_failed", {
          source_id: source.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    client.release();
  }
  let sourcePreviewReport: SourcePreviewReport | undefined;
  if (options.dryRun && options.collectSourcePreview && previewSource && previewDrafts.length > 0) {
    sourcePreviewReport = buildSourcePreviewReport(previewSource, previewDrafts, previewLimit);
    log("info", "source_preview_complete", {
      source_slug: sourcePreviewReport.source_slug,
      flagged_pct: sourcePreviewReport.flagged_pct,
      sampled: sourcePreviewReport.sampled,
    });
  }
  return { failedSources, touchedResourceIds: [...touchedResourceIds], ingestSkippedDueToLock: false, sourcePreviewReport };
}

async function finishRun(
  runId: string,
  status: string,
  counts: { discovered: number; fetched: number; created: number; updated: number; unchanged: number; failed: number; duplicates: number },
  durationMs: number,
  errorSummary: string | null,
): Promise<void> {
  await getPool().query(
    `UPDATE ingestion_runs SET
       status = $2, completed_at = now(), items_discovered = $3, items_fetched = $4,
       items_new = $5, items_updated = $6, items_unchanged = $7, items_failed = $8,
       resources_created = $5, resources_updated = $6, duplicates_found = $9,
       error_summary = $10, duration_ms = $11
     WHERE id = $1`,
    [
      runId,
      status,
      counts.discovered,
      counts.fetched,
      counts.created,
      counts.updated,
      counts.unchanged,
      counts.failed,
      counts.duplicates,
      errorSummary,
      durationMs,
    ],
  );
}

async function recordError(sourceSlug: string, runId: string, ref: DiscoveredRef | null, error: unknown): Promise<void> {
  const status = error instanceof HttpStatusError ? error.status : error instanceof AccessBlockedError ? error.status : null;
  const message = error instanceof Error ? error.message : String(error);
  await getPool().query(
    `INSERT INTO ingestion_errors (source_id, ingestion_run_id, url, stage, http_status, error_type, message)
     SELECT id, $2, $3, 'fetch', $4, $5, $6 FROM sources WHERE slug = $1`,
    [sourceSlug, runId, ref?.url ?? null, status, error instanceof Error ? error.name : "Error", message.slice(0, 500)],
  );
}
