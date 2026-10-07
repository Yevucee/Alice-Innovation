const LATIN_NON_ENGLISH_HINT =
  /\b(und|der|die|das|den|dem|des|ein|eine|einer|einem|einen|ist|sind|war|waren|nicht|auch|mit|für|auf|bei|von|zum|zur|über|nach|oder|aber|wenn|dass|sich|wir|ihr|Sie|können|wurde|werden|haben|hat|sich|über|Autor|Redaktion)\b/i;

/** True when UI should offer on-demand translation (non-English metadata or script). */
export function likelyNeedsTranslation(text: string, language?: string | null): boolean {
  const lang = (language ?? "").trim().toLowerCase();
  if (lang && lang !== "en" && !lang.startsWith("en-")) return true;
  if (/[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uac00-\ud7af\u0600-\u06ff\u0e00-\u0e7f\u0900-\u097f]/.test(text)) {
    return true;
  }
  const sample = text.replace(/\s+/g, " ").trim();
  if (sample.length < 24) return false;
  if (/[äöüßÄÖÜ]/.test(sample)) return true;
  const words = sample.split(/\s+/);
  if (words.length < 6) return false;
  const hits = words.filter((word) => LATIN_NON_ENGLISH_HINT.test(word)).length;
  return hits >= 3;
}
