/** True when UI should offer on-demand translation (non-English metadata or script). */
export function likelyNeedsTranslation(text: string, language?: string | null): boolean {
  const lang = (language ?? "").trim().toLowerCase();
  if (lang && lang !== "en" && !lang.startsWith("en-")) return true;
  return /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uac00-\ud7af\u0600-\u06ff\u0e00-\u0e7f\u0900-\u097f]/.test(text);
}
