import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { closePool, getPool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

let loaded = false;

/** Load repo-root `.env` when Next.js cwd is `apps/web`. */
export function ensureEnv(): void {
  if (loaded) return;
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) loadDotEnv(file);
  }
  loaded = true;
}

export function pool() {
  ensureEnv();
  return getPool();
}

export async function shutdownPool(): Promise<void> {
  await closePool();
}
