import type { ResourceTranslationPayload } from "@alice/database";

export type TranslateProviderId = "google" | "openrouter";

export function inlineTranslationConfigured(): boolean {
  return resolveTranslateProvider() != null;
}

function resolveTranslateProvider(): TranslateProviderId | null {
  const forced = (process.env.TRANSLATE_PROVIDER ?? "auto").toLowerCase();
  const googleKey = process.env.GOOGLE_TRANSLATION_API_KEY?.trim();
  const openRouterKey =
    process.env.TRANSLATE_API_KEY?.trim()
    || process.env.ENRICH_API_KEY?.trim()
    || process.env.EMBEDDING_API_KEY?.trim();

  if (forced === "google") return googleKey ? "google" : null;
  if (forced === "openrouter") return openRouterKey ? "openrouter" : null;
  if (googleKey) return "google";
  if (openRouterKey) return "openrouter";
  return null;
}

function payloadToStrings(payload: ResourceTranslationPayload): { keys: (keyof ResourceTranslationPayload)[]; texts: string[] } {
  const keys: (keyof ResourceTranslationPayload)[] = [];
  const texts: string[] = [];
  for (const key of [
    "title",
    "summary",
    "excerpt",
    "problem_statement",
    "how_it_works",
    "why_it_is_interesting",
    "intended_users",
    "implementation_requirements",
  ] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      keys.push(key);
      texts.push(value);
    }
  }
  return { keys, texts };
}

async function googleTranslate(texts: string[], targetLanguage: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATION_API_KEY?.trim();
  if (!apiKey) throw new Error("google_translation_not_configured");
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, target: targetLanguage, format: "text" }),
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`google_translation_${response.status}:${body.slice(0, 160)}`);
  }
  const json = (await response.json()) as {
    data?: { translations?: Array<{ translatedText: string }> };
  };
  const out = json.data?.translations?.map((row) => row.translatedText) ?? [];
  if (out.length !== texts.length) throw new Error("google_translation_length_mismatch");
  return out;
}

async function openRouterTranslate(
  payload: ResourceTranslationPayload,
  targetLanguage: string,
): Promise<ResourceTranslationPayload> {
  const apiKey =
    process.env.TRANSLATE_API_KEY
    || process.env.ENRICH_API_KEY
    || process.env.EMBEDDING_API_KEY
    || "";
  const baseUrl = (process.env.TRANSLATE_BASE_URL || process.env.ENRICH_BASE_URL || process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const model = process.env.TRANSLATE_MODEL || process.env.ENRICH_MODEL || "google/gemini-2.5-flash-lite";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(process.env.OPENROUTER_HTTP_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Translate innovation-library fields to ${targetLanguage === "en" ? "English" : targetLanguage}. Return JSON with the same keys as input. Keep proper nouns when sensible.`,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`openrouter_translation_${response.status}:${body.slice(0, 160)}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("openrouter_translation_empty");
  return JSON.parse(content) as ResourceTranslationPayload;
}

export async function translateResourcePayload(
  payload: ResourceTranslationPayload,
  targetLanguage: string,
): Promise<{ translated: ResourceTranslationPayload; provider: TranslateProviderId; model: string }> {
  const provider = resolveTranslateProvider();
  if (!provider) throw new Error("translation_not_configured");

  if (provider === "google") {
    const { keys, texts } = payloadToStrings(payload);
    const translatedTexts = await googleTranslate(texts, targetLanguage);
    const translated = { ...payload };
    keys.forEach((key, index) => {
      translated[key] = translatedTexts[index];
    });
    return { translated, provider, model: "google-translation-v2" };
  }

  const model = process.env.TRANSLATE_MODEL || process.env.ENRICH_MODEL || "google/gemini-2.5-flash-lite";
  const translated = await openRouterTranslate(payload, targetLanguage);
  return { translated, provider: "openrouter", model };
}
