import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { runIngestion } from "./pipeline.js";

loadDotEnv();
process.env.SERVICE_NAME = "alice-ingestor";

function argValues(flag: string): string[] {
  const values: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) values.push(argv[++i]);
  }
  return values;
}

function argNumber(flag: string): number | null {
  const value = argValues(flag)[0];
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function main(): Promise<void> {
  const only = argValues("--source");
  const dueOnly = process.argv.includes("--due") || only.length === 0;
  const full = process.argv.includes("--full");
  const dryRun = process.argv.includes("--dry-run");
  const limit = argNumber("--limit");
  const sources = loadSources();
  log("info", "ingest_start", { due_only: dueOnly, full, dry_run: dryRun, limit, sources: only });
  const result = await runIngestion({ sources, only, dueOnly: only.length === 0 ? dueOnly : false, limit, full, dryRun });
  if (result.failedSources.length) {
    log("warn", "ingest_finished_with_source_failures", { sources: result.failedSources });
  } else {
    log("info", "ingest_finished", {});
  }
  await closePool();
}

main().catch(async (error: unknown) => {
  log("error", "ingest_crashed", { message: error instanceof Error ? error.message : String(error) });
  try {
    await getPool().end();
  } catch {
    // Pool may never have opened.
  }
  process.exitCode = 1;
});
