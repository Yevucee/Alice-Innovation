import { isManualIngestTrigger, isRailwayCronRun } from "./post-deploy-jobs.js";

/** Cron passes `--due` and sets RAILWAY_CRON=1. Manual Railway "Run now" uses the same argv without cron → ingest all enabled sources. */
export function resolveIngestDueOnly(input: {
  forcedOnly: boolean;
  cleanupOnly: boolean;
  previewEnv: string | undefined;
  argv: string[];
}): boolean {
  if (input.forcedOnly) return false;
  if (input.cleanupOnly || input.previewEnv) return false;
  if (input.argv.includes("--all-enabled")) return false;
  if (input.argv.includes("--due")) {
    return isRailwayCronRun();
  }
  return !isManualIngestTrigger();
}
