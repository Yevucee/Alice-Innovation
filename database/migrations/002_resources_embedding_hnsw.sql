-- HNSW index for vector similarity once the catalogue is large enough (~2k+ resources).
CREATE INDEX IF NOT EXISTS resources_embedding_hnsw_idx
  ON resources USING hnsw (embedding vector_cosine_ops)
  WHERE active AND embedding IS NOT NULL;
