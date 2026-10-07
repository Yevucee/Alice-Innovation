import type { NormalisedDraft } from "@alice/shared";
import { log } from "@alice/shared";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

/** When true, ingest will call a translation provider and set resources.source_summary_en (not wired yet). */
export function ingestTranslateSummaryToEnEnabled(): boolean {
  return envFlag("INGEST_TRANSLATE_SUMMARY_TO_EN", false);
}

/**
 * Future hook: quick English summary at ingest for non-English items.
 * Default no-op — enable via INGEST_TRANSLATE_SUMMARY_TO_EN after wiring Cloud Translation or similar.
 */
export async function maybeTranslateSummaryForIngest(draft: NormalisedDraft): Promise<{
  source_summary_en: string | null;
}> {
  if (!ingestTranslateSummaryToEnEnabled()) {
    return { source_summary_en: null };
  }
  log("info", "ingest_summary_translate_skipped", {
    reason: "provider_not_wired",
    hint: "Set INGEST_TRANSLATE_SUMMARY_TO_EN only after Cloud Translation (or similar) is configured",
  });
  return { source_summary_en: null };
}
