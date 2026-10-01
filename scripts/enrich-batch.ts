import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { enrichMaxPerRun, runEnrichmentBackfill } from "../apps/ingestor/src/enrich.js";

loadDotEnv();

async function main(): Promise<void> {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : enrichMaxPerRun();
  const pool = getPool();
  const summary = await runEnrichmentBackfill(pool, { limit });
  log("info", "enrich_batch_complete", summary);
  await closePool();
}

main().catch(async (error: unknown) => {
  log("error", "enrich_batch_failed", { message: error instanceof Error ? error.message : String(error) });
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
