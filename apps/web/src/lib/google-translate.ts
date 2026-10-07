/** Free Google Translate links — work in mobile browsers (opens Google site/app). No API key. */

const MAX_TEXT_CHARS = 4500;

export function googleTranslateTextUrl(text: string, targetLanguage = "en"): string {
  const trimmed = text.trim().slice(0, MAX_TEXT_CHARS);
  return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(targetLanguage)}&op=translate&text=${encodeURIComponent(trimmed)}`;
}

export function googleTranslatePageUrl(pageUrl: string, targetLanguage = "en"): string {
  return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(targetLanguage)}&u=${encodeURIComponent(pageUrl)}`;
}
