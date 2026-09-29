import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sha256 } from "@alice/shared";
import express from "express";
import { getPool } from "@alice/database";
import { authorisedMcp } from "./auth.js";
import { issueClientCredentialsToken, oauthMetadata, publicBaseUrl, readTokenRequest } from "./oauth.js";
import { allowRequest } from "./rate-limit.js";
import { createLibraryServer } from "./server.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    res.json(oauthMetadata(publicBaseUrl(req)));
  });

  app.post("/oauth/token", async (req, res) => {
    if (process.env.MCP_OAUTH_ENABLED !== "true") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const parsed = readTokenRequest(req.body);
    if (!parsed) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const issued = await issueClientCredentialsToken(parsed.clientId, parsed.clientSecret);
    if (!issued) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }
    res.json({
      access_token: issued.access_token,
      token_type: "Bearer",
      expires_in: issued.expires_in,
      scope: "mcp",
    });
  });

  app.all("/mcp", async (req, res) => {
    const expected = process.env.MCP_AUTH_TOKEN ?? "";
    if (!await authorisedMcp(getPool(), req.header("authorization"), expected)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const key = sha256(req.header("authorization") ?? "");
    if (!allowRequest(key)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const server = createLibraryServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: "mcp_error" });
    }
  });

  return app;
}
