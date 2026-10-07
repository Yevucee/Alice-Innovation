import { NextRequest, NextResponse } from "next/server";
import {
  getResource,
  readResourceUiTranslation,
  resourceTranslationFingerprint,
  writeResourceUiTranslation,
  type ResourceTranslationPayload,
} from "@alice/database";
import { requireSession } from "@/lib/api-auth";
import { pool } from "@/lib/db";
import { translateOnDemandEnabled, translateResourceFields, translateSettings } from "@/lib/translate-openrouter";

function buildPayload(resource: Record<string, unknown>): ResourceTranslationPayload {
  const interpretation = resource.interpretation as Record<string, unknown> | null;
  const payload: ResourceTranslationPayload = {
    title: String(resource.title ?? ""),
    summary: String(resource.source_summary ?? ""),
  };
  const excerpt = resource.excerpt ? String(resource.excerpt) : "";
  if (excerpt.trim()) payload.excerpt = excerpt;
  if (interpretation?.problem_statement) payload.problem_statement = String(interpretation.problem_statement);
  if (interpretation?.how_it_works) payload.how_it_works = String(interpretation.how_it_works);
  if (interpretation?.why_it_is_interesting) {
    payload.why_it_is_interesting = String(interpretation.why_it_is_interesting);
  }
  if (interpretation?.intended_users) payload.intended_users = String(interpretation.intended_users);
  if (interpretation?.implementation_requirements) {
    payload.implementation_requirements = String(interpretation.implementation_requirements);
  }
  return payload;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requireSession(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!translateOnDemandEnabled()) {
    return NextResponse.json({ error: "translation_not_configured" }, { status: 503 });
  }

  const { id } = await context.params;
  let targetLanguage = "en";
  try {
    const body = (await request.json()) as { targetLanguage?: string };
    if (body.targetLanguage?.trim()) targetLanguage = body.targetLanguage.trim().toLowerCase();
  } catch {
    /* default en */
  }

  const resource = await getResource(pool(), id);
  if (!resource) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const source = buildPayload(resource);
  const fingerprint = resourceTranslationFingerprint(source);
  const cached = await readResourceUiTranslation(pool(), id, targetLanguage, fingerprint);
  if (cached) {
    return NextResponse.json({ translated: cached, cached: true, target_language: targetLanguage });
  }

  try {
    const translated = await translateResourceFields(source, targetLanguage);
    const settings = translateSettings();
    await writeResourceUiTranslation(pool(), {
      resourceId: id,
      targetLanguage,
      fingerprint,
      translated,
      model: settings?.model ?? "unknown",
    });
    return NextResponse.json({ translated, cached: false, target_language: targetLanguage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "translation_failed", message }, { status: 502 });
  }
}
