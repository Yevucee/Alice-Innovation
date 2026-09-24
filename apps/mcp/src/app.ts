import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sha256 } from "@alice/shared";
import express from "express";
import { authorised } from "./auth.js";
import { allowRequest } from "./rate-limit.js";
import { createLibraryServer } from "./server.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.all("/mcp", async (req, res) => {
    const expected = process.env.MCP_AUTH_TOKEN ?? "";
    if (!authorised(req.header("authorization"), expected)) {
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
