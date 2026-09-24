import { createHash } from "node:crypto";
import { log } from "@alice/shared";

export interface EmbeddingSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
}

export function embeddingSettings(): EmbeddingSettings {
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || 1536);
  return {
    baseUrl: (process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: process.env.EMBEDDING_API_KEY || "",
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    dimensions: Number.isFinite(dimensions) ? dimensions : 1536,
  };
}

export function embeddingVersion(settings = embeddingSettings()): string {
  return createHash("sha256").update(`${settings.model}:${settings.dimensions}`).digest("hex").slice(0, 12);
}

/**
 * OpenAI-compatible embeddings. Returns null when no key is configured so
 * ingestion can still store source facts and full-text search.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const settings = embeddingSettings();
  if (!settings.apiKey || texts.length === 0) return null;
  const body: Record<string, unknown> = {
    model: settings.model,
    input: texts,
  };
  if (settings.model.startsWith("text-embedding-3")) {
    body.dimensions = settings.dimensions;
  }
  const response = await fetch(`${settings.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${settings.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    log("warn", "embedding_failed", { status: response.status, detail: detail.slice(0, 200) });
    return null;
  }
  const payload = (await response.json()) as { data?: Array<{ embedding: number[]; index: number }> };
  const rows = payload.data ?? [];
  rows.sort((a, b) => a.index - b.index);
  return rows.map((row) => row.embedding);
}
