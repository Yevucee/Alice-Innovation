import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMigrations, closePool, getPool, libraryStats } from "../../packages/database/src/index.ts";
import { createApp } from "../../apps/mcp/src/app.ts";
import type { AddressInfo } from "node:net";

const databaseUrl = process.env.DATABASE_URL;

test("migrations, stats, health, and bearer rejection", { skip: !databaseUrl }, async () => {
  const pool = getPool();
  const applied = await applyMigrations(pool);
  assert.ok(Array.isArray(applied));
  const stats = await libraryStats(pool);
  assert.equal(typeof stats.canonical_resources, "number");

  const previous = process.env.MCP_AUTH_TOKEN;
  process.env.MCP_AUTH_TOKEN = "integration-token";
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    const denied = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(denied.status, 401);
    const allowed = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer integration-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.notEqual(allowed.status, 401);
    const body = await allowed.text();
    assert.match(body, /get_library_stats/);
    assert.match(body, /search_library/);
  } finally {
    process.env.MCP_AUTH_TOKEN = previous;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await closePool();
  }
});
