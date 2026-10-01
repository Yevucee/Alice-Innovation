import type { SearchFilters } from "@alice/database";
import { searchWithEmbedding } from "@alice/database";
import { pool } from "./db";

export { searchWithEmbedding };

export async function searchLibraryForWeb(filters: SearchFilters) {
  return searchWithEmbedding(pool(), filters);
}
