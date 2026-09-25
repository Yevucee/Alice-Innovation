#!/usr/bin/env node
/** Emit a TCP-proxy DATABASE_URL for local/agent runs against Railway pgvector. */
const user = process.env.PGUSER;
const password = process.env.PGPASSWORD;
const host = process.env.RAILWAY_TCP_PROXY_DOMAIN;
const port = process.env.RAILWAY_TCP_PROXY_PORT;
const database = process.env.PGDATABASE;
if (!user || !password || !host || !port || !database) {
  console.error("Missing PG* or RAILWAY_TCP_PROXY_* (run via: railway run -s pgvector …)");
  process.exit(1);
}
const enc = encodeURIComponent(password);
process.stdout.write(`postgresql://${user}:${enc}@${host}:${port}/${database}`);
