import { auditDraftShape } from "@alice/database";
import { evaluateDraftQuality } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { prepareIngestDraft } from "../apps/ingestor/src/prepare-draft.js";
import { shouldDropIngestAtQualityGate } from "../apps/ingestor/src/ingest-quality-drop.js";
import { fetchText, HttpStatusError } from "../apps/ingestor/src/http.js";

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
  console.log("discovered", refs.length);

  const buckets = new Map<string, number>();
  const bump = (key: string) => buckets.set(key, (buckets.get(key) ?? 0) + 1);

  for (const ref of refs) {
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
        bump(`shape:${shape.join(",")}`);
        continue;
      }
      const quality = evaluateDraftQuality(prepared);
      if (shouldDropIngestAtQualityGate(source.id, quality.needsReview, quality.reasons)) {
        bump(`hard_drop:${quality.reasons.join(",")}`);
        continue;
      }
      if (quality.needsReview) {
        bump(`needs_review:${quality.reasons.join(",") || "unspecified"}`);
        continue;
      }
      bump("would_auto_ingest");
    } catch (e) {
      if (e instanceof HttpStatusError) bump(`http_${e.status}`);
      else bump(`error:${e instanceof Error ? e.message.slice(0, 80) : String(e)}`);
    }
  }

  console.log("breakdown", [...buckets.entries()].sort((a, b) => b[1] - a[1]));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
