import type { SearchFilters } from "@alice/database";
import { searchLibrary } from "@alice/database";
import { embedTexts } from "@alice/ingestor/embeddings";
import { pool } from "./db";

export async function searchWithEmbedding(filters: SearchFilters) {
  let vector: number[] | null = null;
  if (filters.query.trim()) {
    const vectors = await embedTexts([filters.query]);
    const candidate = vectors?.[0];
    if (candidate && candidate.length === 1536) vector = candidate;
  }
  return searchLibrary(pool(), filters, vector);
}
