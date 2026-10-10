import { canonicaliseUrl, tryCanonicaliseUrl } from "@alice/shared";
import { buildDraft } from "../apps/ingestor/src/adapters/draft.ts";
import { resolveHub71PublicUrl } from "../apps/ingestor/src/hub71-url.ts";
import { fetchText } from "../apps/ingestor/src/http.js";

async function main(): Promise<void> {
  const UA = "AliceInnovationLibrary/0.1";
  const rows: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 4; page += 1) {
    const res = await fetchText(`https://www.hub71.com/all-startups?perPage=100&page=${page}`, {
      userAgent: UA,
      timeoutMs: 30000,
    });
    const payload = JSON.parse(res.body) as { data?: Array<Record<string, unknown>> };
    rows.push(...(payload.data ?? []));
  }
  const bad: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const slug = (row.slug as { en?: string })?.en ?? "";
    if (!slug) continue;
    const detail = `https://www.hub71.com/startups/${slug}`;
    const pub = resolveHub71PublicUrl(row.website as string | null | undefined, detail);
    try {
      canonicaliseUrl(pub);
      buildDraft({
        title: (row.title as { en?: string })?.en ?? slug,
        url: pub,
        externalId: slug,
        summary: "x".repeat(40),
        text: "x".repeat(40),
      });
    } catch (error) {
      bad.push({ slug, website: row.website, pub, err: error instanceof Error ? error.message : String(error) });
    }
    const logo = typeof row.logo === "string" ? row.logo : null;
    if (logo && !tryCanonicaliseUrl(logo)) {
      bad.push({ slug, field: "logo", logo, err: "logo not canonicalisable" });
    }
  }
  console.log(JSON.stringify({ total: rows.length, bad: bad.length, samples: bad.slice(0, 20) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
