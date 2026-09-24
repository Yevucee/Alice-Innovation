import { getPool, libraryStats } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import express from "express";
import { authorised } from "../../mcp/src/auth.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-admin";

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  if (process.env.ADMIN_ENABLED !== "true") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (!authorised(req.header("authorization"), process.env.MCP_AUTH_TOKEN ?? "")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
});

app.get("/", async (_req, res) => {
  const stats = await libraryStats(getPool());
  res.json({ title: "Alice Innovation Library", ...stats });
});

const port = Number(process.env.ADMIN_PORT || 8081);
app.listen(port, "0.0.0.0", () => {
  log("info", "admin_listening", { port, enabled: process.env.ADMIN_ENABLED === "true" });
});
