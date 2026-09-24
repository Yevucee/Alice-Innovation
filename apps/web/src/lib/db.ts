import { closePool, getPool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";

let loaded = false;

export function ensureEnv(): void {
  if (!loaded) {
    loadDotEnv();
    loaded = true;
  }
}

export function pool() {
  ensureEnv();
  return getPool();
}

export async function shutdownPool(): Promise<void> {
  await closePool();
}
