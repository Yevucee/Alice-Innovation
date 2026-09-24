import { existsSync, readFileSync } from "node:fs";

export type LogSeverity = "debug" | "info" | "warn" | "error";

const SECRET_KEYS = /token|secret|api[_-]?key|authorization|password/i;

export function log(severity: LogSeverity, event: string, fields: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEYS.test(key)) continue;
    safe[key] = value;
  }
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      severity,
      service: process.env.SERVICE_NAME ?? "alice",
      event,
      ...safe,
    }),
  );
}

export function loadDotEnv(file = ".env"): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
