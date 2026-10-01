import type { CompactResource } from "../../packages/database/src/search.js";

export function topResultsMatchPattern(
  results: CompactResource[],
  pattern: RegExp,
  topN = 5,
): boolean {
  if (results.length < topN) return false;
  return results.slice(0, topN).every((row) => pattern.test(`${row.title} ${row.short_summary}`));
}
