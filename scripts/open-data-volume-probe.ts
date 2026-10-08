/**
 * Dry-run open-data / bulk sources: discover totals, quality gate pass rate, dedupe estimate.
 * Usage: npx tsx scripts/open-data-volume-probe.ts [--slug=a,b] [--discover-cap=2000]
 */
import { loadSources } from "@alice/source-registry";
import { auditDraftShape, getPool, closePool } from "@alice/database";
import { loadDotEnv } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import type { AdapterContext } from "../apps/ingestor/src/adapters/types.js";
import type { NormalisedDraft } from "@alice/shared";

loadDotEnv();

const DEFAULT_SLUGS = [
  "ycombinator-oss-companies",
  "usaspending-sbir-awards",
  "usaspending-sttr-awards",
  "nih-sbir-sttr-portfolio",
  "nsf-awards-catalogue",
  "ukri-gtr-research-projects",
  "world-bank-development-projects",
  "eu-innovation-radar",
];

const SAMPLE = 10;

function parseArgs(): { slugs: string[]; discoverCap: number | null } {
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const capArg = process.argv.find((a) => a.startsWith("--discover-cap="))?.split("=")[1];
  const slugs = slugArg
    ? slugArg.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SLUGS;
  const discoverCap = capArg ? Number(capArg) : 2500;
  return { slugs, discoverCap };
}

function buildContext(source: ReturnType<typeof loadSources>[number], limit: number | null): AdapterContext {
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 45000);
  return {
    source,
    userAgent,
    timeoutMs,
    limit,
    fetchText: (url) => fetchText(url, { userAgent, timeoutMs }),
  };
}

function passesQualityGate(draft: NormalisedDraft): boolean {
  const reasons = auditDraftShape(draft);
  return reasons.length === 0;
}

async function countExistingUrls(pool: Awaited<ReturnType<typeof getPool>>, urls: string[]): Promise<number> {
  if (urls.length === 0) return 0;
  const row = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM source_items WHERE canonical_url = ANY($1::text[])`,
    [urls],
  );
  return row.rows[0]?.n ?? 0;
}

async function probeSlug(slug: string, discoverCap: number | null): Promise<void> {
  const sources = loadSources();
  const source = sources.find((s) => s.id === slug);
  if (!source) {
    console.log(`\n## ${slug}\nMISSING from sources.yaml`);
    return;
  }
  const adapter = getAdapter(source.adapter);
  if (!adapter) {
    console.log(`\n## ${slug}\nNo adapter: ${source.adapter}`);
    return;
  }

  const pool = getPool();
  const ctx = buildContext(source, discoverCap);
  console.log(`\n## ${slug} (enabled=${source.enabled}, adapter=${adapter.id})`);
  console.log(`licence/robots: skipRobots=${adapter.skipRobotsGuard === true ? "yes (API/json)" : "no"}; collection=${source.collection_url ?? "—"}`);

  let refs;
  try {
    refs = await adapter.discover(ctx);
  } catch (error) {
    console.log(`discover FAILED: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  console.log(`discovered_refs=${refs.length}${discoverCap !== null ? ` (cap=${discoverCap})` : ""}`);

  let parsed = 0;
  let passGate = 0;
  const sampleDrafts: NormalisedDraft[] = [];
  const allUrls: string[] = [];

  const parseLimit = Math.min(refs.length, 400);
  for (let i = 0; i < parseLimit; i += 1) {
    const ref = refs[i];
    try {
      const page = await adapter.fetch(ref, ctx);
      const draft = adapter.parse(page);
      parsed += 1;
      allUrls.push(draft.canonicalUrl);
      if (passesQualityGate(draft)) passGate += 1;
      if (sampleDrafts.length < SAMPLE) sampleDrafts.push(draft);
    } catch {
      // count as parse fail
    }
  }

  const gateRate = parsed > 0 ? (100 * passGate / parsed).toFixed(1) : "—";
  console.log(`parsed_sample=${parsed} quality_gate_pass=${passGate} (${gateRate}% of sample)`);

  const urlSample = allUrls.slice(0, 500);
  const existingInDb = await countExistingUrls(pool, urlSample);
  const extrapolate =
    refs.length > 0 && urlSample.length > 0
      ? Math.round(refs.length * (1 - existingInDb / urlSample.length))
      : null;
  console.log(`dedupe_estimate: ${existingInDb}/${urlSample.length} sample URLs already in source_items → est_new≈${extrapolate ?? "?"}`);

  console.log("\n### Sample records (up to 10)");
  for (const d of sampleDrafts) {
    console.log(`- ${d.title.slice(0, 70)} | ${d.canonicalUrl.slice(0, 90)}`);
  }
}

async function main(): Promise<void> {
  const { slugs, discoverCap } = parseArgs();
  for (const slug of slugs) {
    await probeSlug(slug, discoverCap);
  }
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
