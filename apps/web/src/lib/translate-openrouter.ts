import type { ResourceTranslationPayload } from "@alice/database";

export interface TranslateSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function translateSettings(): TranslateSettings | null {
  const apiKey = process.env.TRANSLATE_API_KEY || process.env.ENRICH_API_KEY || process.env.EMBEDDING_API_KEY || "";
  if (!apiKey) return null;
  return {
    baseUrl: (process.env.TRANSLATE_BASE_URL || process.env.ENRICH_BASE_URL || process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
    apiKey,
    model: process.env.TRANSLATE_MODEL || process.env.ENRICH_MODEL || "google/gemini-2.5-flash-lite",
  };
}

export function translateOnDemandEnabled(): boolean {
  if (process.env.TRANSLATE_ON_DEMAND_ENABLED === "false") return false;
  return translateSettings() != null;
}

export async function translateResourceFields(
  input: ResourceTranslationPayload,
  targetLanguage: string,
): Promise<ResourceTranslationPayload> {
  const settings = translateSettings();
  if (!settings) {
    throw new Error("translation_not_configured");
  }

  const system = `You translate innovation-library resource text into ${targetLanguage === "en" ? "English" : targetLanguage}.
Preserve proper nouns and organisation names where sensible. Return ONLY valid JSON with the same keys as the input; omit keys that were empty in the input.`;

  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
      ...(process.env.OPENROUTER_HTTP_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`translation_api_${response.status}:${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("translation_empty_response");

  const parsed = JSON.parse(content) as ResourceTranslationPayload;
  return {
    title: String(parsed.title ?? input.title),
    summary: String(parsed.summary ?? input.summary),
    excerpt: parsed.excerpt ?? input.excerpt,
    problem_statement: parsed.problem_statement ?? input.problem_statement,
    how_it_works: parsed.how_it_works ?? input.how_it_works,
    why_it_is_interesting: parsed.why_it_is_interesting ?? input.why_it_is_interesting,
    intended_users: parsed.intended_users ?? input.intended_users,
    implementation_requirements: parsed.implementation_requirements ?? input.implementation_requirements,
  };
}
