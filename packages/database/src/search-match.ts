import type { Queryable } from "./pool.js";
import {
  FILTER_SQL,
  appendSemanticQueryParams,
  filterParams,
  OR_TERM_MATCH_COUNT_SQL,
  semanticDistancePredicateSql,
  type SearchFilters,
} from "./search-sql.js";

export function semanticMaxDistance(): number {
  const raw = Number(process.env.SEARCH_SEMANTIC_MAX_DISTANCE ?? "0.42");
  return Number.isFinite(raw) ? raw : 0.42;
}

/** Minimum matched OR-terms when websearch is empty (relaxed path). */
export function orLexicalMinTerms(relaxed: boolean, query: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  if (!relaxed) return 1;
  return terms.length >= 4 ? 2 : 1;
}

export function matchPredicateSql(
  options: { includeSemantic: boolean; orMinTerms: number },
): string {
  const orClause = `${OR_TERM_MATCH_COUNT_SQL} >= ${options.orMinTerms}`;
  const semanticClause = options.includeSemantic
    ? `OR (
         r.embedding IS NOT NULL
         AND ${semanticDistancePredicateSql()}
       )`
    : "";
  return `(
    r.search_vector @@ websearch_to_tsquery('english', $1)
    OR (${orClause})
    ${semanticClause}
  )`;
}

export async function countSearchMatches(
  db: Queryable,
  filters: SearchFilters,
  queryEmbedding: number[] | null,
  orMinTerms: number,
): Promise<number> {
  const query = filters.query.trim();
  if (!query) return 0;
  const params = filterParams(filters);
  const maxDistance = semanticMaxDistance();
  const hasVector = Boolean(queryEmbedding && queryEmbedding.length === 1536);
  const predicate = matchPredicateSql({ includeSemantic: hasVector, orMinTerms });
  const row = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM resources r
     WHERE r.active = true
       AND ${FILTER_SQL}
       AND ${predicate}`,
    hasVector
      ? appendSemanticQueryParams(params, queryEmbedding!, maxDistance)
      : params,
  );
  return Number(row.rows[0]?.count ?? 0);
}
