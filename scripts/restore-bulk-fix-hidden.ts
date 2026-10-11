/**
 * Restore resources hidden by NEEDS_REVIEW bulk-fix (junk_* reason codes).
 *
 *   npx tsx scripts/restore-bulk-fix-hidden.ts --dry-run
 *   npx tsx scripts/restore-bulk-fix-hidden.ts --apply
 */
import {
  closePool,
  countBulkFixHiddenResources,
  getPool,
  restoreBulkFixHiddenBatch,
} from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const pool = getPool();
  const count = await countBulkFixHiddenResources(pool);
  if (!apply) {
    log("info", "restore_bulk_fix_hidden_dry_run", { matching_hidden: count });
    console.log(`Would restore up to ${count} ARCHIVED row(s) with junk_* reason codes. Pass --apply to run.`);
    await closePool();
    return;
  }
  const batch = await restoreBulkFixHiddenBatch(pool, { limit: 5000 });
  log("info", "restore_bulk_fix_hidden_applied", { restored: batch.restored, matching_before: count });
  console.log(`Restored ${batch.restored} row(s).`);
  await closePool();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
