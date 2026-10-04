export interface OrganisationNameContext {
  resourceTitle: string;
  sourceName?: string | null;
}

const SENTENCE_START = /^(we|it|i|our|this|currently|the solution|my|they)\b/i;
const VERBISH = /\b(is|are|was|were|being|been|have|has|had|will|would|can|could)\b/i;

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalisedKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when the org name is the same as the resource title (not treated as invalid). */
export function organisationNameMatchesResourceTitle(name: string, title: string): boolean {
  return normalisedKey(name) === normalisedKey(title);
}

/** Reject MIT Solve-style free-text registration answers stored as organisation names. */
export function isInvalidOrganisationName(
  name: string | null | undefined,
  ctx: OrganisationNameContext,
): boolean {
  if (!name?.trim()) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;
  if (ctx.sourceName && normalisedKey(trimmed) === normalisedKey(ctx.sourceName)) return true;
  if (/[.!?]$/.test(trimmed) && wordCount(trimmed) >= 4) return true;
  if (wordCount(trimmed) > 8) return true;
  if (SENTENCE_START.test(trimmed) && wordCount(trimmed) >= 3) return true;
  if (VERBISH.test(trimmed) && wordCount(trimmed) >= 5) return true;
  return false;
}

export function sanitiseOrganisationName(
  name: string | null | undefined,
  ctx: OrganisationNameContext,
): string | null {
  if (!name?.trim()) return null;
  return isInvalidOrganisationName(name, ctx) ? null : name.trim();
}
