# Admin skeleton

Phase 7 will add the maintenance UI. This process exposes nothing unless `ADMIN_ENABLED=true`.
When enabled, `GET /` requires the same bearer token as MCP and returns library counts.
Do not deploy it as a public service.
