export function convertAllCapsTitleToTitleCase(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  return trimmed
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      const letters = part.replace(/[^A-Za-z]/g, "");
      if (letters.length > 0 && letters.length <= 3 && letters === letters.toUpperCase()) {
        return part;
      }
      const lower = part.toLowerCase();
      return lower.replace(/(^|[^a-z])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
    })
    .join("");
}

export function looksLikeAllCapsTitle(title: string): boolean {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length <= 6) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.75 && /[A-Z]/.test(title);
}

/** Alias used by summary repair helpers. */
export const normaliseAllCapsTitle = convertAllCapsTitleToTitleCase;
