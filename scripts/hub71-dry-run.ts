import { auditDraftShape } from "@alice/database";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";

async function main(): Promise<void> {
  const source = loadSources().find((s) => s.id === "hub71-startup-directory");
  if (!source) throw new Error("missing source");
  const adapter = getAdapter("hub71-startup-directory");
  if (!adapter) throw new Error("missing adapter");
  const fetch = (url: string) => fetchText(url, { userAgent: "AliceInnovationLibrary/0.1", timeoutMs: 30000 });
  const refs = await adapter.discover({
    source,
    userAgent: "AliceInnovationLibrary/0.1",
    timeoutMs: 30000,
    limit: null,
    fetchText: fetch,
  });
  console.log("discovered", refs.length);
  let pass = 0;
  let fail = 0;
  for (const ref of refs) {
    const page = await adapter.fetch(ref, {
      source,
      userAgent: "AliceInnovationLibrary/0.1",
      timeoutMs: 30000,
      limit: null,
      fetchText: fetch,
    });
    const draft = adapter.parse(page);
    if (auditDraftShape(draft).length === 0) pass += 1;
    else fail += 1;
  }
  console.log("quality_gate_pass", pass);
  console.log("quality_gate_fail", fail);
  console.log("would_insert_estimate", pass);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
