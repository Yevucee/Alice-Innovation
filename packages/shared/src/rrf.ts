export interface RankedHit {
  id: string;
  sourceId?: string | null;
}

export interface FusedHit {
  id: string;
  score: number;
  sourceId?: string | null;
  lists: string[];
}

/**
 * Reciprocal Rank Fusion. Rank is 1-based. Default k follows the original paper.
 */
export function reciprocalRankFusion(lists: Array<{ name: string; hits: RankedHit[] }>, k = 60): FusedHit[] {
  const scores = new Map<string, FusedHit>();
  for (const list of lists) {
    list.hits.forEach((hit, index) => {
      const rank = index + 1;
      const current = scores.get(hit.id) ?? {
        id: hit.id,
        score: 0,
        sourceId: hit.sourceId ?? null,
        lists: [],
      };
      current.score += 1 / (k + rank);
      if (!current.sourceId && hit.sourceId) current.sourceId = hit.sourceId;
      current.lists.push(list.name);
      scores.set(hit.id, current);
    });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Stops one source from filling a broad result list.
 * A source filter already applied by the caller should pass maxPerSource = Infinity.
 */
export function capPerSource<T extends { id: string; sourceId?: string | null }>(
  hits: T[],
  limit: number,
  maxPerSource: number,
): T[] {
  if (!Number.isFinite(maxPerSource)) return hits.slice(0, limit);
  const counts = new Map<string, number>();
  const kept: T[] = [];
  for (const hit of hits) {
    const key = hit.sourceId || "unknown";
    const used = counts.get(key) ?? 0;
    if (used >= maxPerSource) continue;
    counts.set(key, used + 1);
    kept.push(hit);
    if (kept.length >= limit) break;
  }
  return kept;
}

export function defaultPerSourceCap(limit: number): number {
  return Math.max(2, Math.ceil(limit / 4));
}
