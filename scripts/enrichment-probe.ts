/**
 * Read-only enrichment probe: reports how many pending rows would get country/stage from
 * text inference alone vs still missing. Optional --live=1 performs one OpenRouter call.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/enrichment-probe.ts --limit=20
 */
import { applyMigrations, closePool, getPool, loadEnrichmentCandidates } from "@alice/database";
import { inferCountryFromText } from "@alice/taxonomy";
import { enrichSettings, enrichResourceOnIngest } from "../apps/ingestor/src/enrich.js";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

async function main(): Promise<void> {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 20;
  const live = process.argv.includes("--live=1");
  const pool = getPool();
  await applyMigrations(pool);
  const candidates = await loadEnrichmentCandidates(pool, limit, null);
  let inferCountry = 0;
  let inferStageFromText = 0;
  for (const row of candidates) {
    const inferred = inferCountryFromText(`${row.title}\n${row.source_summary}\n${row.extracted_index_text}`);
    if (inferred.countryName && (!row.primary_country_name || !row.primary_country_name.trim())) {
      inferCountry += 1;
    }
    if (row.evidence_stage === "UNKNOWN" && /pilot|deployed|prototype|scaled/i.test(row.extracted_index_text)) {
      inferStageFromText += 1;
    }
  }
  log("info", "enrichment_probe_readonly", {
    limit,
    candidates: candidates.length,
    would_infer_country_from_text: inferCountry,
    sample_titles: candidates.slice(0, 5).map((row) => row.title),
  });
  if (live && candidates[0]) {
    const row = candidates[0];
    const result = await enrichResourceOnIngest(
      pool,
      row.id,
      {
        title: row.title,
        summary: row.source_summary,
        text: row.extracted_index_text,
        countryName: row.primary_country_name,
        evidenceStage: row.evidence_stage,
        hasOrganisation: false,
        reviewStatus: row.review_status,
      },
      { settings: enrichSettings() },
    );
    log("info", "enrichment_probe_live_one", { resource_id: row.id, ...result });
  }
  await closePool();
}

main().catch(async (error: unknown) => {
  log("error", "enrichment_probe_failed", { message: error instanceof Error ? error.message : String(error) });
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
