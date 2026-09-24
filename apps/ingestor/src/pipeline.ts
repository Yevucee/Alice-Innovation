import {
  confirmDisappearances,
  getPool,
  noteSemanticDuplicate,
  readCheckpoint,
  saveEmbedding,
  upsertDraft,
  writeCheckpoint,
} from "@alice/database";
import { canonicaliseUrl, contentHash, log } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import { classifyResource } from "./classifier.js";
import { embedTexts, embeddingSettings, embeddingVersion } from "./embeddings.js";
import { fetchText, HttpStatusError } from "./http.js";
import { robotsAllows } from "./robots.js";
import { getAdapter } from "./adapters/registry.js";
import { AccessBlockedError, type AdapterContext, type DiscoveredRef } from "./adapters/types.js";

const LOCK_KEY = 84261001;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
}

export async function runIngestion(options: IngestOptions): Promise<{ failedSources: string[] }> {
  const pool = getPool();
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const client = await pool.connect();
  const locked = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
  if (!locked.rows[0]?.locked) {
    log("info", "ingest_skipped", { reason: "lock_held" });
    client.release();
    return { failedSources: [] };
  }

  const failedSources: string[] = [];
  try {
    const selected = options.sources.filter((source) => {
      if (options.only && options.only.length > 0) return options.only.includes(source.id);
      return source.enabled;
    });
    for (const source of selected) {
      const started = Date.now();
      try {
        const meta = await pool.query<{ last_successful_run: Date | null; id: string }>(
          "SELECT id::text, last_successful_run FROM sources WHERE slug = $1",
          [source.id],
        );
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
        };
        try {
          const adapter = getAdapter(source.adapter);
          if (!adapter) {
            throw new Error(`No adapter implementation for ${source.adapter}`);
          }
          const target = source.collection_url || source.discovery.sitemap || source.homepage;
          await guardRobots(source, userAgent, timeoutMs, target);
          let lastRequest = 0;
          const minInterval = Math.ceil(60000 / Math.max(1, source.limits.requests_per_minute));
          const pacedFetch = async (url: string) => {
            const wait = minInterval - (Date.now() - lastRequest);
            if (wait > 0) await sleep(wait);
            lastRequest = Date.now();
            return fetchText(url, { userAgent, timeoutMs });
          };
          const ctx: AdapterContext = {
            source,
            userAgent,
            timeoutMs,
            limit: options.limit,
            fetchText: pacedFetch,
          };
          let refs = await adapter.discover(ctx);
          counts.discovered = refs.length;
          const checkpoint = options.full ? await readCheckpoint(pool, source.id) : "";
          const catalogue = refs.map((ref) => canonicaliseUrl(ref.url));
          if (checkpoint) refs = refs.filter((ref) => ref.url > checkpoint);
          if (options.limit !== null) refs = refs.slice(0, options.limit);
          let cursor = checkpoint;
          for (const ref of refs) {
            try {
              const page = await adapter.fetch(ref, ctx);
              counts.fetched += 1;
              const draft = adapter.parse(page);
              if (options.dryRun) {
                log("info", "dry_run_item", { source_id: source.id, title: draft.title, url: draft.canonicalUrl });
                cursor = ref.url;
                continue;
              }
              const saved = await upsertDraft(pool, source.id, draft, runId);
              if (saved.outcome === "unchanged") counts.unchanged += 1;
              else if (saved.outcome === "created") counts.created += 1;
              else counts.updated += 1;
              if (saved.outcome !== "unchanged") {
                try {
                  const text = [draft.title, draft.sourceSummary, draft.extractedText.slice(0, 1000), draft.organisationName ?? "", draft.countryName ?? ""].join("\n");
                  const vectors = await embedTexts([text]);
                  const vector = vectors?.[0];
                  if (vector && vector.length === 1536) {
                    const settings = embeddingSettings();
                    await saveEmbedding(pool, saved.resourceId, vector, settings.model, embeddingVersion(settings), contentHash([text]));
                    counts.duplicates += await noteSemanticDuplicate(pool, saved.resourceId);
                  } else if (vector) {
                    log("warn", "embedding_dimensions", { source_id: source.id, length: vector.length });
                  }
                  await classifyResource(pool, saved.resourceId, {
                    title: draft.title,
                    summary: draft.sourceSummary,
                    text: draft.extractedText,
                  });
                } catch (error) {
                  log("warn", "post_process_failed", {
                    source_id: source.id,
                    resource_id: saved.resourceId,
                    message: error instanceof Error ? error.message : String(error),
                  });
                }
              }
              cursor = ref.url;
              if (options.full && !options.dryRun) await writeCheckpoint(pool, source.id, cursor);
            } catch (error) {
              counts.failed += 1;
              await recordError(source.id, runId, ref, error);
            }
          }
          if (options.full && !options.dryRun && options.limit === null && !checkpoint && adapter.fullCatalogue) {
            await confirmDisappearances(pool, source.id, catalogue);
          }
          const status = counts.failed > 0 ? "PARTIAL_SUCCESS" : "SUCCESS";
          await finishRun(runId, status, counts, Date.now() - started, null);
          if (status === "SUCCESS" || counts.created + counts.updated + counts.unchanged > 0) {
            await pool.query("UPDATE sources SET last_successful_run = now(), updated_at = now() WHERE slug = $1", [source.id]);
          }
          log("info", "source_finished", { source_id: source.id, run_id: runId, ...counts, duration_ms: Date.now() - started });
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
  return { failedSources };
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
