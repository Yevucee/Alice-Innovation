import { loadDotEnv, log } from "@alice/shared";
import { createApp } from "./app.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-mcp";

const port = Number(process.env.PORT || 8080);
const app = createApp();
app.listen(port, "0.0.0.0", () => {
  log("info", "mcp_listening", { port });
});
