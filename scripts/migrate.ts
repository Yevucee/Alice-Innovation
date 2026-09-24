import { applyMigrations, closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

const applied = await applyMigrations(getPool());
log("info", "migrations_applied", { versions: applied });
await closePool();
