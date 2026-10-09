import { auditDraftShape } from "@alice/database";
import { evaluateDraftQuality } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { prepareIngestDraft } from "../apps/ingestor/src/prepare-draft.js";
import { fetchText, HttpStatusError } from "../apps/ingestor/src/http.js";
import { mapWithConcurrency } from "../apps/ingestor/src/detail-fetch.js";

async function main(): Promise<void> {
  const source = loadSources().find((s) => s.id === "solar-impulse");
  if (!source) throw new Error("missing source");
  const adapter = getAdapter("solar-impulse");
  if (!adapter) throw new Error("missing adapter");
  const fetch = (url: string) => fetchText(url, { userAgent: "AliceInnovationLibrary/0.1", timeoutMs: 45000 });
  const refs = await adapter.discover({
    source,
    userAgent: "AliceInnovationLibrary/0.1",
    timeoutMs: 45000,
    limit: null,
    fetchText: fetch,
  });
  const buckets = new Map<string, number>();
  const bump = (key: string) => buckets.set(key, (buckets.get(key) ?? 0) + 1);

  await mapWithConcurrency(refs, 6, async (ref) => {
    try {
      const page = await adapter.fetch(ref, {
        source,
        userAgent: "AliceInnovationLibrary/0.1",
        timeoutMs: 45000,
        limit: null,
        fetchText: fetch,
      });
      const parsed = adapter.parse(page);
      const prepared = prepareIngestDraft(parsed, source);
      const shape = auditDraftShape(prepared);
      if (shape.length > 0) {
        for (const code of shape) bump(`shape:${code}`);
        return;
      }
      const quality = evaluateDraftQuality(prepared);
      if (quality.needsReview) {
        bump(`needs_review:${quality.reasons.join(",") || "unspecified"}`);
        return;
      }
      bump("auto_ingest");
    } catch (e) {
      if (e instanceof HttpStatusError) bump(`http_${e.status}`);
      else bump(`error:${(e instanceof Error ? e.message : String(e)).slice(0, 60)}`);
    }
  });

  const total = refs.length;
  const entries = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  console.log("discovered", total);
  console.log("breakdown", entries);
  const auto = buckets.get("auto_ingest") ?? 0;
  const review = entries.filter(([k]) => k.startsWith("needs_review:")).reduce((s, [, n]) => s + n, 0);
  const shape = entries.filter(([k]) => k.startsWith("shape:")).reduce((s, [, n]) => s + n, 0);
  const http = entries.filter(([k]) => k.startsWith("http_")).reduce((s, [, n]) => s + n, 0);
  const err = entries.filter(([k]) => k.startsWith("error:")).reduce((s, [, n]) => s + n, 0);
  console.log("summary", { auto, needs_review: review, shape_fail: shape, http_fail: http, parse_fail: err });
  console.log("expected_gap_vs_full_auto", total - auto, "(admin ingested may include NEEDS_REVIEW rows)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
