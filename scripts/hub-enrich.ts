import { closePool, getPool } from "@alice/database";
import {
  enrichInnovationHubWebsitesByNameMatch,
  linkCandidatesToExistingSources,
  refreshSourceCandidateHomepages,
  reprobeSourceCandidates,
} from "@alice/hub-discovery";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

function argFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function argNumber(flag: string, fallback: number): number {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) return Number(argv[++i]);
  }
  return fallback;
}

async function fetchText(url: string) {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html,application/json" },
    redirect: "follow",
  });
  return { status: response.status, body: await response.text(), finalUrl: response.url };
}

async function main(): Promise<void> {
  const pool = getPool();
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const ctx = { userAgent, fetchText, limit: null };

  const stats: Record<string, number> = {};
  const onlyMatch = argFlag("--match-only");
  const onlyReprobe = argFlag("--reprobe-only");
  const doMatch = argFlag("--match-names") || (!onlyMatch && !onlyReprobe);
  const doReprobe = argFlag("--reprobe") || (!onlyMatch && !onlyReprobe);
  if (doMatch) {
    stats.websites_merged = await enrichInnovationHubWebsitesByNameMatch(pool);
    stats.candidate_homepages_refreshed = await refreshSourceCandidateHomepages(pool);
    stats.candidates_linked_to_sources = await linkCandidatesToExistingSources(pool);
  }
  if (doReprobe) {
    const reprobe = await reprobeSourceCandidates(pool, ctx, argNumber("--limit", 150));
    stats.reprobe_probed = reprobe.probed;
    stats.reprobe_robots_ok = reprobe.robotsOk;
  }

  log("info", "hub_enrich_complete", stats);
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "hub_enrich_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
