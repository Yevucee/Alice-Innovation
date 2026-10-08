/**
 * Show CORDIS innovation-filter rejections (first N raw projects from search/en API).
 */
import { loadDotEnv } from "@alice/shared";
import { cordisInnovationFilterReasons } from "../apps/ingestor/src/adapters/open-data/innovation-filter.js";

loadDotEnv();

const CORDIS_SEARCH_EN = "https://cordis.europa.eu/search/en";
const TARGET = 10;

async function main(): Promise<void> {
  const params = new URLSearchParams({
    format: "json",
    q: "contenttype=project",
    p: "1",
    num: "50",
  });
  const ua = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1";
  const res = await fetch(`${CORDIS_SEARCH_EN}?${params}`, { headers: { "user-agent": ua } });
  const payload = await res.json() as {
    hits?: { hit?: Array<{ project?: { title?: string; acronym?: string; teaser?: string; id?: string } }> };
  };
  const hits = payload.hits?.hit ?? [];
  const rejected: Array<{ title: string; id: string; reasons: string[] }> = [];
  for (const row of hits) {
    const p = row.project;
    if (!p?.id) continue;
    const reasons = cordisInnovationFilterReasons({
      title: p.title,
      teaser: p.teaser,
      relatedProjectAcronym: p.acronym,
    });
    if (reasons.length === 0) continue;
    rejected.push({
      title: (p.title || p.acronym || p.id).slice(0, 100),
      id: p.id,
      reasons,
    });
    if (rejected.length >= TARGET) break;
  }
  console.log("# CORDIS innovation filter — rejected examples (page 1 sample)\n");
  console.log("Filter keeps rows whose title/teaser/acronym match innovation keywords and avoid admin-only wording.\n");
  for (const row of rejected) {
    console.log(`- **${row.title}** (id ${row.id}) — ${row.reasons.join("; ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
