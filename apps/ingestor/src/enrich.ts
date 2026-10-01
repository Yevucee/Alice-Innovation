import {
  applyEnrichmentToResource,
  enrichmentInputHash,
  loadEnrichmentCandidates,
  readEnrichmentCache,
  recordEnrichmentRun,
  writeEnrichmentCache,
  type EnrichmentPayload,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";

export interface EnrichSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function enrichSettings(): EnrichSettings {
  return {
    baseUrl: (process.env.ENRICH_BASE_URL || process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
    apiKey: process.env.ENRICH_API_KEY || process.env.EMBEDDING_API_KEY || "",
    model: process.env.ENRICH_MODEL || "google/gemini-2.5-flash-lite",
  };
}

export function enrichEnabled(): boolean {
  return process.env.ENRICH_ENABLED !== "false";
}

export function enrichMaxPerRun(): number {
  const raw = process.env.ENRICH_MAX_PER_RUN;
  if (raw == null || raw === "") return 50;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 50;
}

function resourceNeedsEnrichment(input: {
  countryName: string | null;
  evidenceStage: string;
  hasOrganisation: boolean;
}): boolean {
  return !input.countryName?.trim() || input.evidenceStage === "UNKNOWN" || !input.hasOrganisation;
}

async function callEnrichmentLlm(
  settings: EnrichSettings,
  evidence: { title: string; summary: string; text: string },
  fetchImpl: typeof fetch,
): Promise<{ payload: EnrichmentPayload | null; totalTokens: number }> {
  const response = await fetchImpl(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${settings.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Extract JSON keys country, city, stage, problem, sector, organisation_name. Use UNKNOWN when unclear.",
        },
        {
          role: "user",
          content: `${evidence.title}\n${evidence.summary}\n${evidence.text.slice(0, 1500)}`,
        },
      ],
    }),
  });
  if (!response.ok) {
    log("warn", "enrich_llm_failed", { status: response.status });
    return { payload: null, totalTokens: 0 };
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  try {
    return {
      payload: JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as EnrichmentPayload,
      totalTokens: body.usage?.total_tokens ?? 0,
    };
  } catch {
    return { payload: null, totalTokens: body.usage?.total_tokens ?? 0 };
  }
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
): Promise<{ enriched: boolean; totalTokens: number }> {
  if (!enrichEnabled()) return { enriched: false, totalTokens: 0 };
  if (evidence.reviewStatus === "NEEDS_REVIEW") return { enriched: false, totalTokens: 0 };
  if (!resourceNeedsEnrichment(evidence)) return { enriched: false, totalTokens: 0 };

  const settings = options?.settings ?? enrichSettings();
  if (!settings.apiKey) return { enriched: false, totalTokens: 0 };

  const hash = enrichmentInputHash(evidence.title, evidence.summary, evidence.text);
  let payload = await readEnrichmentCache(db, hash);
  let totalTokens = 0;
  if (!payload) {
    const fetchImpl = options?.fetchImpl ?? fetch;
    const llm = await callEnrichmentLlm(settings, evidence, fetchImpl);
    payload = llm.payload;
    totalTokens = llm.totalTokens;
    if (payload) await writeEnrichmentCache(db, hash, settings.model, payload);
  }

  if (!payload) return { enriched: false, totalTokens };
  const changed = await applyEnrichmentToResource(db, resourceId, payload);
  return { enriched: changed, totalTokens };
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
  enriched: number;
  skipped: number;
  failed: number;
  total_tokens: number;
  estimated_cost_usd: number;
}> {
  const candidates = await loadEnrichmentCandidates(db, input.limit, input.resourceIds ?? null);
  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  let total_tokens = 0;

  for (const candidate of candidates) {
    try {
      const org = await db.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM resource_organisations WHERE resource_id = $1::uuid) AS exists`,
        [candidate.id],
      );
      const result = await enrichResourceOnIngest(
        db,
        candidate.id,
        {
          title: candidate.title,
          summary: candidate.source_summary,
          text: candidate.extracted_index_text,
          countryName: candidate.primary_country_name,
          evidenceStage: candidate.evidence_stage,
          hasOrganisation: org.rows[0]?.exists === true,
          reviewStatus: candidate.review_status,
        },
        { fetchImpl: input.fetchImpl },
      );
      total_tokens += result.totalTokens;
      if (result.enriched) enriched += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  const estimated_cost_usd = Number((total_tokens * 0.0000005).toFixed(6));
  await recordEnrichmentRun(db, {
    processed: candidates.length,
    enriched,
    skipped,
    failed,
    total_tokens,
    estimated_cost_usd,
  });

  return {
    processed: candidates.length,
    enriched,
    skipped,
    failed,
    total_tokens,
    estimated_cost_usd,
  };
}
