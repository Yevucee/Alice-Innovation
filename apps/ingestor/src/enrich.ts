import {
  applyEnrichmentToResource,
  enrichmentInputHash,
  loadEnrichmentCandidates,
  parseEnrichmentMessageContent,
  readEnrichmentCache,
  recordEnrichmentRun,
  recordResourceEnrichmentAttempt,
  writeEnrichmentCache,
  type EnrichmentOutcome,
  type EnrichmentPayload,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";

export interface EnrichSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallbackModel: string;
}

export const ENRICHMENT_PAUSED_BUDGET_NOTE = "enrichment_paused_budget";

export function enrichSettings(): EnrichSettings {
  return {
    baseUrl: (process.env.ENRICH_BASE_URL || process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
    apiKey: process.env.ENRICH_API_KEY || process.env.EMBEDDING_API_KEY || "",
    model: process.env.ENRICH_MODEL || "google/gemini-2.5-flash-lite",
    fallbackModel: process.env.ENRICH_FALLBACK_MODEL || "openai/gpt-4o-mini",
  };
}

export function enrichEnabled(): boolean {
  return process.env.ENRICH_ENABLED !== "false";
}

export function enrichMaxPerRun(): number {
  const raw = process.env.ENRICH_MAX_PER_RUN;
  if (raw == null || raw === "") return 15_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 15_000;
}

export function enrichConcurrency(): number {
  const raw = process.env.ENRICH_CONCURRENCY;
  if (raw == null || raw === "") return 8;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 16) : 8;
}

function resourceNeedsEnrichment(input: {
  countryName: string | null;
  evidenceStage: string;
  hasOrganisation: boolean;
}): boolean {
  return !input.countryName?.trim() || input.evidenceStage === "UNKNOWN" || !input.hasOrganisation;
}

export function isEnrichmentBudgetError(status: number, bodyText: string): boolean {
  if (status === 402) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("insufficient credits")
    || lower.includes("credit limit")
    || lower.includes("payment required")
    || lower.includes("exceeded your")
    || lower.includes("spending limit")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function modelError(status: number, bodyText: string): boolean {
  if (status === 404 || status === 400) {
    const lower = bodyText.toLowerCase();
    return lower.includes("model") || lower.includes("not found");
  }
  return false;
}

let parseFailureLogBudget = 3;

async function callEnrichmentLlm(
  settings: EnrichSettings,
  evidence: { title: string; summary: string; text: string },
  fetchImpl: typeof fetch,
): Promise<{
  payload: EnrichmentPayload | null;
  totalTokens: number;
  budgetPaused: boolean;
  rateLimited: boolean;
  modelUsed: string;
  parseError?: string;
}> {
  const models = [settings.model, settings.fallbackModel].filter((value, index, arr) => arr.indexOf(value) === index);
  let attempt = 0;
  while (attempt < 6) {
    attempt += 1;
    for (const model of models) {
      const response = await fetchImpl(`${settings.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${settings.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Extract JSON keys country, city, stage, problem, sector, organisation_name. Use UNKNOWN when unclear. country must be a real country name when mentioned.",
            },
            {
              role: "user",
              content: `${evidence.title}\n${evidence.summary}\n${evidence.text.slice(0, 1500)}`,
            },
          ],
        }),
      });
      const bodyText = await response.text();
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delayMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(30_000, 1000 * 2 ** attempt);
        await sleep(delayMs);
        break;
      }
      if (!response.ok) {
        if (isEnrichmentBudgetError(response.status, bodyText)) {
          return { payload: null, totalTokens: 0, budgetPaused: true, rateLimited: false, modelUsed: model };
        }
        if (modelError(response.status, bodyText) && model !== models[models.length - 1]) {
          log("warn", "enrich_llm_model_failed", { status: response.status, model });
          continue;
        }
        log("warn", "enrich_llm_failed", { status: response.status, model });
        return { payload: null, totalTokens: 0, budgetPaused: false, rateLimited: false, modelUsed: model };
      }
      let body: {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      try {
        body = JSON.parse(bodyText) as typeof body;
      } catch {
        return { payload: null, totalTokens: 0, budgetPaused: false, rateLimited: false, modelUsed: model, parseError: "response_json_invalid" };
      }
      const content = body.choices?.[0]?.message?.content ?? "{}";
      const parsed = parseEnrichmentMessageContent(content);
      if (!parsed.payload && parseFailureLogBudget > 0) {
        parseFailureLogBudget -= 1;
        log("warn", "enrich_llm_parse_failed", {
          model,
          error: parsed.error,
          raw_sample: parsed.rawSample,
        });
      }
      return {
        payload: parsed.payload,
        totalTokens: body.usage?.total_tokens ?? 0,
        budgetPaused: false,
        rateLimited: false,
        modelUsed: model,
        parseError: parsed.error,
      };
    }
  }
  return { payload: null, totalTokens: 0, budgetPaused: false, rateLimited: true, modelUsed: settings.model };
}

export async function enrichResourceOnIngest(
  db: Queryable,
  resourceId: string,
  evidence: {
    title: string;
    summary: string;
    text: string;
    countryName: string | null;
    evidenceStage: string;
    hasOrganisation: boolean;
    reviewStatus: string;
  },
  options?: { settings?: EnrichSettings; fetchImpl?: typeof fetch },
): Promise<{
  outcome: EnrichmentOutcome | "skipped" | "cached";
  applied: boolean;
  totalTokens: number;
  budgetPaused: boolean;
}> {
  if (!enrichEnabled()) return { outcome: "skipped", applied: false, totalTokens: 0, budgetPaused: false };
  if (evidence.reviewStatus === "NEEDS_REVIEW") return { outcome: "skipped", applied: false, totalTokens: 0, budgetPaused: false };
  if (!resourceNeedsEnrichment(evidence)) return { outcome: "skipped", applied: false, totalTokens: 0, budgetPaused: false };

  const settings = options?.settings ?? enrichSettings();
  if (!settings.apiKey) return { outcome: "skipped", applied: false, totalTokens: 0, budgetPaused: false };

  const inputHash = enrichmentInputHash(evidence.title, evidence.summary, evidence.text);
  let payload = await readEnrichmentCache(db, inputHash);
  let totalTokens = 0;
  let modelUsed = settings.model;
  let fromCache = Boolean(payload);

  if (!payload) {
    const fetchImpl = options?.fetchImpl ?? fetch;
    const llm = await callEnrichmentLlm(settings, evidence, fetchImpl);
    modelUsed = llm.modelUsed;
    if (llm.budgetPaused) {
      return { outcome: "skipped", applied: false, totalTokens: 0, budgetPaused: true };
    }
    payload = llm.payload;
    totalTokens = llm.totalTokens;
    if (payload) await writeEnrichmentCache(db, inputHash, modelUsed, payload);
  }

  if (!payload) {
    await recordResourceEnrichmentAttempt(db, resourceId, {
      inputHash,
      model: modelUsed,
      outcome: "no_data",
    });
    return { outcome: "no_data", applied: false, totalTokens, budgetPaused: false };
  }

  const applyResult = await applyEnrichmentToResource(db, resourceId, payload, evidence);
  await recordResourceEnrichmentAttempt(db, resourceId, {
    inputHash,
    model: modelUsed,
    outcome: applyResult.outcome,
  });

  return {
    outcome: fromCache && applyResult.outcome === "applied" ? "cached" : applyResult.outcome,
    applied: applyResult.changed,
    totalTokens,
    budgetPaused: false,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function runEnrichmentBackfill(
  db: Queryable,
  input: {
    limit: number;
    resourceIds?: string[] | null;
    fetchImpl?: typeof fetch;
  },
): Promise<{
  processed: number;
  attempted: number;
  applied: number;
  no_data: number;
  enriched: number;
  skipped: number;
  failed: number;
  total_tokens: number;
  estimated_cost_usd: number;
  enriched_resource_ids: string[];
  paused_budget: boolean;
}> {
  parseFailureLogBudget = 3;
  const candidates = await loadEnrichmentCandidates(db, input.limit, input.resourceIds ?? null);
  let attempted = 0;
  let applied = 0;
  let no_data = 0;
  let skipped = 0;
  let failed = 0;
  let total_tokens = 0;
  let paused_budget = false;
  const enriched_resource_ids: string[] = [];
  const concurrency = enrichConcurrency();
  const budget = { paused: false };

  if (candidates.length === 0) {
    await recordEnrichmentRun(db, {
      processed: 0,
      attempted: 0,
      applied: 0,
      no_data: 0,
      enriched: 0,
      skipped: 0,
      failed: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
    });
    return {
      processed: 0,
      attempted: 0,
      applied: 0,
      no_data: 0,
      enriched: 0,
      skipped: 0,
      failed: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      enriched_resource_ids: [],
      paused_budget: false,
    };
  }

  const orgFlags = await db.query<{ resource_id: string; exists: boolean }>(
    `SELECT r.id::text AS resource_id,
            EXISTS (SELECT 1 FROM resource_organisations ro WHERE ro.resource_id = r.id) AS exists
     FROM resources r
     WHERE r.id = ANY($1::uuid[])`,
    [candidates.map((c) => c.id)],
  );
  const orgById = new Map(orgFlags.rows.map((row) => [row.resource_id, row.exists]));

  const outcomes = await mapWithConcurrency(candidates, concurrency, async (candidate) => {
    if (budget.paused) {
      return { kind: "skipped" as const, totalTokens: 0, resourceId: candidate.id };
    }
    try {
      const result = await enrichResourceOnIngest(
        db,
        candidate.id,
        {
          title: candidate.title,
          summary: candidate.source_summary,
          text: candidate.extracted_index_text,
          countryName: candidate.primary_country_name,
          evidenceStage: candidate.evidence_stage,
          hasOrganisation: orgById.get(candidate.id) === true,
          reviewStatus: candidate.review_status,
        },
        { fetchImpl: input.fetchImpl },
      );
      if (result.budgetPaused) {
        budget.paused = true;
        log("info", "enrichment_paused_budget", {});
        return { kind: "skipped" as const, totalTokens: 0, resourceId: candidate.id };
      }
      if (result.outcome === "skipped") {
        return { kind: "skipped" as const, totalTokens: result.totalTokens, resourceId: candidate.id };
      }
      if (result.outcome === "failed") {
        return { kind: "failed" as const, totalTokens: result.totalTokens, resourceId: candidate.id };
      }
      if (result.applied) {
        return { kind: "applied" as const, totalTokens: result.totalTokens, resourceId: candidate.id };
      }
      return { kind: "no_data" as const, totalTokens: result.totalTokens, resourceId: candidate.id };
    } catch {
      return { kind: "failed" as const, totalTokens: 0, resourceId: candidate.id };
    }
  });

  for (const outcome of outcomes) {
    total_tokens += outcome.totalTokens;
    if (outcome.kind === "applied") {
      attempted += 1;
      applied += 1;
      enriched_resource_ids.push(outcome.resourceId);
    } else if (outcome.kind === "no_data") {
      attempted += 1;
      no_data += 1;
    } else if (outcome.kind === "failed") {
      attempted += 1;
      failed += 1;
    } else skipped += 1;
  }

  paused_budget = budget.paused;
  const estimated_cost_usd = Number((total_tokens * 0.0000005).toFixed(6));
  await recordEnrichmentRun(db, {
    processed: candidates.length,
    attempted,
    applied,
    no_data,
    enriched: applied,
    skipped,
    failed,
    total_tokens,
    estimated_cost_usd,
    note: paused_budget ? ENRICHMENT_PAUSED_BUDGET_NOTE : undefined,
  });

  return {
    processed: candidates.length,
    attempted,
    applied,
    no_data,
    enriched: applied,
    skipped,
    failed,
    total_tokens,
    estimated_cost_usd,
    enriched_resource_ids,
    paused_budget,
  };
}
