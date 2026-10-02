import { closePool, getPool } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import {
  backfillSourceItemImages,
  loadSourceItemsMissingImages,
} from "../apps/ingestor/src/image-backfill.js";

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

function argNumber(flag: string): number {
  const value = argValues(flag)[0];
  const parsed = Number(value ?? "50");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function argFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const sourceSlug = argValues("--source")[0];
  if (!sourceSlug) {
    console.error("Usage: tsx scripts/backfill-images-from-db.ts --source <slug> [--limit N] [--validate]");
    process.exitCode = 1;
    return;
  }
  const limit = argNumber("--limit");
  const validateRemote = argFlag("--validate");
  const sources = loadSources();
  const source = sources.find((entry) => entry.id === sourceSlug);
  if (!source) {
    console.error(`Unknown source: ${sourceSlug}`);
    process.exitCode = 1;
    return;
  }

  const pool = getPool();
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const minInterval = Math.ceil(60000 / Math.max(1, source.limits.requests_per_minute));

  const rows = await loadSourceItemsMissingImages(pool, { sourceSlug, limit });
  const summary = await backfillSourceItemImages(pool, rows, {
    userAgent,
    timeoutMs,
    validateRemote,
    minIntervalMs: minInterval,
  });

  log("info", "image_backfill_complete", { source: sourceSlug, validateRemote, ...summary });
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "image_backfill_crashed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
