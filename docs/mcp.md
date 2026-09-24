# MCP

Transport: Streamable HTTP on `POST /mcp`, `GET /mcp`, and `DELETE /mcp`. There is no legacy SSE endpoint. The server is stateless (`sessionIdGenerator` unset). Every MCP request needs `Authorization: Bearer <MCP_AUTH_TOKEN>`.

`GET /health` does not require a token and returns:

```json
{"status":"ok"}
```

In-process rate limit: 60 requests per minute per token. Excess requests receive HTTP 429.

## Tools

All ten tools are registered. Inputs are validated with Zod. Search responses are compact JSON and include `resource_id` plus source links when a resource is returned.

| Tool | Behaviour |
| --- | --- |
| `get_library_stats` | Counts from Postgres |
| `browse_sources` | The seeded catalogue |
| `get_source_status` | One source slug |
| `browse_categories` | Resource types and seeded taxonomy |
| `search_library` | Hybrid search, default limit 10, max 50 |
| `get_resource` | Detail, source URLs, interpretation if any |
| `find_similar` | Vector neighbours of one resource |
| `explore_problem` | Same search with a per-source cap and an explicit note that mechanism diversity is not available yet |
| `search_people` | People table |
| `search_organisations` | Organisations table |

`search_library` may call the embeddings endpoint for the query vector. It does not call a chat model. If embeddings are not configured, it uses full text only and reports `vector: "unavailable"`.

Tool descriptions tell the host model when to call each tool. Source text is labelled as untrusted evidence on `get_resource`.

## Example

```bash
curl -s http://127.0.0.1:8080/health
```

Point an MCP client at `http://127.0.0.1:8080/mcp` with the bearer token. The client speaks Streamable HTTP, not SSE.
