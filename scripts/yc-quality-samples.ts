/**
 * Emit YC OSS pass/fail quality samples for the open-volume report.
 */
import { auditDraftShape } from "@alice/database";
import { loadDotEnv } from "@alice/shared";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import { loadSources } from "@alice/source-registry";
import type { NormalisedDraft } from "@alice/shared";

loadDotEnv();

const PASS_TARGET = 20;
const FAIL_TARGET = 10;

function passes(draft: NormalisedDraft): boolean {
  return auditDraftShape(draft).length === 0;
}

async function main(): Promise<void> {
  const source = loadSources().find((s) => s.id === "ycombinator-oss-companies");
  if (!source) throw new Error("ycombinator-oss-companies missing");
  const adapter = getAdapter("ycombinator-oss-companies");
  if (!adapter) throw new Error("adapter missing");
  const userAgent = process.env.INGESTION_USER_AGENT || "AliceInnovationLibrary/0.1";
  const timeoutMs = 45_000;
  const ctx = {
    source,
    userAgent,
    timeoutMs,
    limit: null as number | null,
    fetchText: (url: string) => fetchText(url, { userAgent, timeoutMs }),
  };
  const refs = await adapter.discover(ctx);
  const pass: NormalisedDraft[] = [];
  const fail: Array<{ draft: NormalisedDraft; reasons: string[] }> = [];
  for (const ref of refs) {
    if (pass.length >= PASS_TARGET && fail.length >= FAIL_TARGET) break;
    try {
      const page = await adapter.fetch(ref, ctx);
      const draft = adapter.parse(page);
      const reasons = auditDraftShape(draft);
      if (reasons.length === 0 && pass.length < PASS_TARGET) pass.push(draft);
      else if (reasons.length > 0 && fail.length < FAIL_TARGET) fail.push({ draft, reasons });
    } catch {
      // skip parse errors
    }
  }
  console.log("# YC OSS quality samples\n");
  console.log(`catalogue_size=${refs.length}\n`);
  console.log("## Pass gate (20)\n");
  for (const d of pass) {
    console.log(`- **${d.title}** — ${d.canonicalUrl} — ${(d.sourceSummary || "").slice(0, 120)}`);
  }
  console.log("\n## Fail gate (10)\n");
  for (const { draft, reasons } of fail) {
    console.log(`- **${draft.title}** — ${draft.canonicalUrl} — reasons: ${reasons.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
