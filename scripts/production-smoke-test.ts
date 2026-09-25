import { closePool, getPool, libraryStats } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

const MCP_URL = process.env.MCP_PUBLIC_URL || "https://alice-mcp-production-16e6.up.railway.app";
const WEB_URL = process.env.WEB_PUBLIC_URL || "https://alice-web-production.up.railway.app";

async function mcpJsonRpc(method: string, params?: Record<string, unknown>): Promise<{ status: number; body: string }> {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) throw new Error("MCP_AUTH_TOKEN is not set");
  const response = await fetch(`${MCP_URL}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return { status: response.status, body: await response.text() };
}

async function main(): Promise<void> {
  const failures: string[] = [];

  const health = await fetch(`${MCP_URL}/health`);
  if (health.status !== 200) failures.push(`mcp_health_${health.status}`);
  else log("info", "smoke_ok", { check: "mcp_health" });

  const webLogin = await fetch(`${WEB_URL}/login`);
  if (webLogin.status !== 200) failures.push(`web_login_${webLogin.status}`);
  else log("info", "smoke_ok", { check: "web_login" });

  const denied = await fetch(`${MCP_URL}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (denied.status !== 401) failures.push(`mcp_auth_expected_401_got_${denied.status}`);
  else log("info", "smoke_ok", { check: "mcp_auth_rejects_anonymous" });

  const tools = await mcpJsonRpc("tools/list");
  if (tools.status === 401) failures.push("mcp_tools_list_unauthorized");
  else if (!tools.body.includes("get_library_stats")) failures.push("mcp_tools_list_missing_tools");
  else log("info", "smoke_ok", { check: "mcp_tools_list" });

  const statsCall = await mcpJsonRpc("tools/call", { name: "get_library_stats", arguments: {} });
  if (statsCall.status >= 400) failures.push(`mcp_get_library_stats_http_${statsCall.status}`);
  else if (!statsCall.body.includes("canonical_resources")) failures.push("mcp_get_library_stats_bad_body");
  else log("info", "smoke_ok", { check: "mcp_get_library_stats" });

  const pool = getPool();
  const stats = await libraryStats(pool);
  if ((stats.canonical_resources ?? 0) < 1) failures.push("db_no_resources");
  else log("info", "smoke_ok", { check: "db_library_stats", canonical_resources: stats.canonical_resources });
  await closePool();

  if (failures.length) {
    log("error", "smoke_failed", { failures });
    process.exitCode = 1;
    return;
  }
  log("info", "smoke_passed", {});
}

main().catch((error: unknown) => {
  log("error", "smoke_crashed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
