# Architecture

Alice Innovation Library is one monorepo and three runtime roles:

- **alice-mcp** stays up. It serves `/health` and Streamable HTTP `/mcp`. It does not keep session state. Durable state is Postgres.
- **alice-db** is Postgres with pgvector. Full-text search is a weighted `tsvector` on the resource (title highest). The embedding column is `vector(1536)`. An ANN index is deliberately not created until the catalogue is large.
- **alice-ingestor** is one cron process. It takes a database advisory lock, runs due sources, and exits. A failure in one source is logged and the next source still runs.

```text
source site -> adapter -> pipeline -> Postgres -> MCP search
```

Adapters do not write to the database. The pipeline owns upsert, hashing, dedupe, optional classification, optional embeddings, and run logs.

## Facts and interpretation

`source_items` and the fact columns on `resources` hold what the source page supported: title, short public summary, capped extracted text, evidence fields, and compact JSON metadata. `resource_interpretations` holds classifier output with `generated_by`, `model`, `generated_at`, and `classification_version`. The classifier is off unless `CLASSIFIER_ENABLED=true`. Search does not call it.

Full article HTML is not stored and is not returned by MCP.

## Search

Keyword rank and vector rank are fused with reciprocal rank fusion in `packages/shared`. Broad queries cap how many hits can come from one source. `explore_problem` uses that search and says plainly that mechanism-level diversity waits for the taxonomy phase.

## Auth

`AUTH_MODE=token` checks `Authorization: Bearer` against `MCP_AUTH_TOKEN` with a constant-time compare. The auth module is separate from the tools so OAuth can be added later. `/health` is unauthenticated and returns only `{"status":"ok"}`.
