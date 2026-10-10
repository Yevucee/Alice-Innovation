import { auditDraftShape } from "@alice/database";
import { canonicaliseUrl } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { buildDraft } from "../apps/ingestor/src/adapters/draft.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import { resolveHub71PublicUrl } from "../apps/ingestor/src/hub71-url.js";
import { loadSources } from "@alice/source-registry";
import { prepareIngestDraft } from "../apps/ingestor/src/prepare-draft.js";
import { enhanceDraftWithQualityDetailIfNeeded } from "../apps/ingestor/src/quality-detail-fetch.js";
import { getRunFailureTracker } from "../apps/ingestor/src/run-failure-tracker.js";

async function main(): Promise<void> {
  const UA = "AliceInnovationLibrary/0.1";
  const rows: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 4; page += 1) {
    const res = await fetch(`https://www.hub71.com/all-startups?page=${page}&perPage=100`, {
      headers: { "user-agent": UA },
    });
    const payload = (await res.json()) as { data?: Array<Record<string, unknown>> };
    rows.push(...(payload.data ?? []));
  }

  const source = loadSources().find((s) => s.id === "hub71-startup-directory")!;
  const adapter = getAdapter("hub71-startup-directory")!;
  const tracker = getRunFailureTracker();

  let buildFail = 0;
  let enhanceFail = 0;
  let gatePass = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const slug = (row.slug as { en?: string })?.en ?? "";
    if (!slug) continue;
    const detail = `https://www.hub71.com/startups/${slug}`;
    const website = row.website as string | null | undefined;
    const pub = resolveHub71PublicUrl(website, detail);
    const logo = typeof row.logo === "string" ? row.logo : null;
    try {
      canonicaliseUrl(pub);
      const draft = buildDraft({
        title: (row.title as { en?: string })?.en ?? slug,
        url: pub,
        externalId: slug,
        summary: "x".repeat(40),
        text: "x".repeat(40),
        resourceType: "ORGANISATION",
        organisationName: (row.title as { en?: string })?.en ?? slug,
        evidenceBasis: "PROGRAMME_SELECTED",
        imageUrl: logo,
      });
      const prepared = prepareIngestDraft(draft, source);
      await enhanceDraftWithQualityDetailIfNeeded(source, prepared, tracker);
      if (auditDraftShape(prepared).length === 0) gatePass += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Invalid URL")) buildFail += 1;
      else enhanceFail += 1;
      if (errors.length < 20) errors.push(`${slug} website=${JSON.stringify(website)} pub=${pub} logo=${logo?.slice(0, 60)} err=${msg}`);
    }
  }

  console.log(JSON.stringify({ rows: rows.length, buildFail, enhanceFail, gatePass, errors }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
