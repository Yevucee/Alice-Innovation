import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Queryable } from "./pool.js";

export async function applyMigrations(db: Queryable, directory = resolve(process.cwd(), "database/migrations")): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = await db.query<{ version: string }>("SELECT version FROM schema_migrations");
  const seen = new Set(applied.rows.map((row) => row.version));
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (seen.has(version)) continue;
    const sql = readFileSync(resolve(directory, file), "utf8");
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await db.query("COMMIT");
      ran.push(version);
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
  return ran;
}
