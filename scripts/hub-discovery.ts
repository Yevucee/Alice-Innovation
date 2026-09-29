import { closePool, getPool } from "@alice/database";
import { runHubDiscovery } from "@alice/hub-discovery";
import { loadDotEnv, log } from "@alice/shared";

loadDotEnv();

function argFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function argValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) return argv[++i];
  }
  return undefined;
}

async function fetchText(url: string): Promise<{ status: number; body: string; finalUrl: string }> {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html,application/json" },
    redirect: "follow",
  });
  const body = await response.text();
  return { status: response.status, body, finalUrl: response.url };
}

async function main(): Promise<void> {
  const directories = argValue("--directories")?.split(",").map((s) => s.trim()).filter(Boolean);
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : null;
  const pool = getPool();
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const stats = await runHubDiscovery(
    pool,
    { userAgent, fetchText, limit },
    {
      directories,
      limitPerDirectory: limit,
      probeCatalogues: argFlag("--probe"),
      checkRobots: argFlag("--robots"),
      linkPortfolios: argFlag("--link-portfolios"),
    },
  );
  log("info", "hub_discovery_complete", stats);
  await closePool();
}

main().catch((error: unknown) => {
  log("error", "hub_discovery_failed", { message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
