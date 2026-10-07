import { createHash } from "node:crypto";
import type { Queryable } from "./pool.js";

export interface ResourceTranslationPayload {
  title: string;
  summary: string;
  excerpt?: string | null;
  problem_statement?: string | null;
  how_it_works?: string | null;
  why_it_is_interesting?: string | null;
  intended_users?: string | null;
  implementation_requirements?: string | null;
}

export function resourceTranslationFingerprint(input: ResourceTranslationPayload): string {
  const normalized = JSON.stringify(input);
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 32);
}

export async function readResourceUiTranslation(
  db: Queryable,
  resourceId: string,
  targetLanguage: string,
  fingerprint: string,
): Promise<ResourceTranslationPayload | null> {
  const row = await db.query<{ translated: ResourceTranslationPayload }>(
    `SELECT translated
     FROM resource_ui_translations
     WHERE resource_id = $1::uuid
       AND target_language = $2
       AND source_fingerprint = $3`,
    [resourceId, targetLanguage, fingerprint],
  );
  return row.rows[0]?.translated ?? null;
}

export async function writeResourceUiTranslation(
  db: Queryable,
  input: {
    resourceId: string;
    targetLanguage: string;
    fingerprint: string;
    translated: ResourceTranslationPayload;
    model: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO resource_ui_translations (resource_id, target_language, source_fingerprint, translated, model)
     VALUES ($1::uuid, $2, $3, $4::jsonb, $5)
     ON CONFLICT (resource_id, target_language) DO UPDATE SET
       source_fingerprint = EXCLUDED.source_fingerprint,
       translated = EXCLUDED.translated,
       model = EXCLUDED.model,
       created_at = now()`,
    [input.resourceId, input.targetLanguage, input.fingerprint, JSON.stringify(input.translated), input.model],
  );
}
