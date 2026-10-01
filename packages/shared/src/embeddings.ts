import { createHash } from "node:crypto";
import { backoffDelayMs, shouldRetryHttpStatus } from "./retry.js";
import { log } from "./log.js";

export interface EmbeddingSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  httpReferer?: string;
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbedTextsResult {
  vectors: number[][] | null;
  usage?: EmbeddingUsage;
  status?: number;
  retryable?: boolean;
}

export function embeddingSettings(): EmbeddingSettings {
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || 1536);
  // EMBEDDING_PROVIDER is legacy metadata only (e.g. openai). Routing uses EMBEDDING_BASE_URL
  // (OpenRouter: https://openrouter.ai/api/v1). It is intentionally not read here.
  void process.env.EMBEDDING_PROVIDER;
  return {
    baseUrl: (process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
    apiKey: process.env.EMBEDDING_API_KEY || "",
    model: process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small",
    dimensions: Number.isFinite(dimensions) ? dimensions : 1536,
    httpReferer: process.env.EMBEDDING_HTTP_REFERER || process.env.OPENROUTER_HTTP_REFERER || undefined,
  };
}

export function embeddingVersion(settings = embeddingSettings()): string {
  return createHash("sha256").update(`${settings.model}:${settings.dimensions}`).digest("hex").slice(0, 12);
}

/** Whether to send the optional `dimensions` body field (OpenAI text-embedding-3 family). */
export function embeddingSupportsDimensionsParam(model: string): boolean {
  const normalised = model.includes("/") ? model.split("/").pop() ?? model : model;
  return normalised.startsWith("text-embedding-3");
}

function embeddingHeaders(settings: EmbeddingSettings): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${settings.apiKey}`,
    "content-type": "application/json",
  };
  if (settings.httpReferer) {
    headers["http-referer"] = settings.httpReferer;
  }
  return headers;
}

/**
 * OpenAI-compatible embeddings (OpenRouter, OpenAI, local gateway).
 * Returns null vectors when no API key is configured.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const result = await embedTextsDetailed(texts);
  return result.vectors;
}

export async function embedTextsDetailed(
  texts: string[],
  options?: { maxAttempts?: number },
): Promise<EmbedTextsResult> {
  const settings = embeddingSettings();
  if (!settings.apiKey || texts.length === 0) {
    return { vectors: null };
  }
  const maxAttempts = options?.maxAttempts ?? 1;
  const body: Record<string, unknown> = {
    model: settings.model,
    input: texts,
  };
  if (embeddingSupportsDimensionsParam(settings.model)) {
    body.dimensions = settings.dimensions;
  }

  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${settings.baseUrl}/embeddings`, {
      method: "POST",
      headers: embeddingHeaders(settings),
      body: JSON.stringify(body),
    });
    lastStatus = response.status;
    if (!response.ok) {
      const detail = await response.text();
      const retryable = shouldRetryHttpStatus(response.status);
      log("warn", "embedding_failed", {
        status: response.status,
        attempt,
        detail: detail.slice(0, 200),
      });
      if (retryable && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, backoffDelayMs(attempt)));
        continue;
      }
      return { vectors: null, status: response.status, retryable };
    }
    const payload = (await response.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };
    const rows = payload.data ?? [];
    rows.sort((a, b) => a.index - b.index);
    const usage = payload.usage
      ? {
          prompt_tokens: payload.usage.prompt_tokens ?? 0,
          total_tokens: payload.usage.total_tokens ?? 0,
        }
      : undefined;
    return {
      vectors: rows.map((row) => row.embedding),
      usage,
      status: response.status,
    };
  }
  return { vectors: null, status: lastStatus, retryable: true };
}

/** Rough USD estimate for text-embedding-3-small list pricing (~$0.02 / 1M tokens). */
export function estimateEmbeddingCostUsd(totalTokens: number): number {
  return (totalTokens / 1_000_000) * 0.02;
}
