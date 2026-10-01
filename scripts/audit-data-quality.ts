import { createWriteStream } from "node:fs";
import { closePool, getPool, runQualityAudit, summariseReasonCounts } from "@alice/database";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const apply = hasFlag("--apply");
  const dryRun = !apply;
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50_000;
  const outArg = process.argv.find((arg) => arg.startsWith("--out="));
  const outPath = outArg?.split("=")[1] ?? `audit-data-quality-${new Date().toISOString().slice(0, 10)}.csv`;

  const pool = getPool();
  const summary = await runQualityAudit(pool, { dryRun, apply, limit });
  const reasonCounts = summariseReasonCounts(summary.rows);

  const stream = createWriteStream(outPath, { encoding: "utf8" });
  stream.write("entity_type,id,title_or_name,source_slug,url,reason_codes,proposed_action\n");
  for (const row of summary.rows) {
    stream.write([
      row.entity_type,
      row.id,
      `"${row.title_or_name.replace(/"/g, '""')}"`,
      row.source_slug ?? "",
      row.url ?? "",
      `"${row.reason_codes.join("|")}"`,
      row.proposed_action,
    ].join(",") + "\n");
  }
  stream.end();

  log("info", "audit_data_quality_complete", {
    dry_run: dryRun,
    apply,
    scanned: summary.scanned,
    flagged: summary.flagged,
    reason_counts: reasonCounts,
    csv: outPath,
  });

  await closePool();
}

main().catch(async (error: unknown) => {
  log("error", "audit_data_quality_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
