import { embedTexts } from "@alice/shared";
import { log } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { searchLibrary, type SearchFilters } from "./search.js";

export type EmbedTextsFn = (texts: string[]) => Promise<number[][] | null>;

const defaultEmbedTexts: EmbedTextsFn = (texts) => embedTexts(texts);

export async function searchWithEmbedding(
  db: Queryable,
  filters: SearchFilters,
  options?: { embedTexts?: EmbedTextsFn },
): Promise<{
  results: Awaited<ReturnType<typeof searchLibrary>>["results"];
  vector: "used" | "unavailable";
  filtered_total: number;
  relaxed: boolean;
}> {
  const embedFn = options?.embedTexts ?? defaultEmbedTexts;
  let queryEmbedding: number[] | null = null;
  let vector: "used" | "unavailable" = "unavailable";
  const query = filters.query.trim();
  if (query) {
    const vectors = await embedFn([query]);
    const candidate = vectors?.[0];
    if (candidate && candidate.length === 1536) {
      queryEmbedding = candidate;
      vector = "used";
    }
  }
  log("info", "search_query_embedding", {
    vector,
    query_chars: query.length,
  });
  const found = await searchLibrary(db, filters, queryEmbedding);
  const resolvedVector = found.vector === "used" ? "used" : vector;
  if (resolvedVector !== found.vector) {
    log("info", "search_vector_status", { embed: vector, semantic_leg: found.vector });
  }
  return {
    results: found.results,
    filtered_total: found.filtered_total,
    vector: resolvedVector,
    relaxed: found.relaxed,
  };
}
