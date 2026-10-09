import { auditDraftShape } from "@alice/database";
import { canonicaliseUrl } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "../apps/ingestor/src/adapters/registry.js";
import { fetchText } from "../apps/ingestor/src/http.js";
import { listingContentHash } from "@alice/database";

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
  const badRef: Array<{ id?: string; url: string; err: string }> = [];
  for (const ref of refs) {
    try {
      canonicaliseUrl(ref.url);
      listingContentHash(ref);
    } catch (e) {
      badRef.push({ id: ref.externalId, url: ref.url, err: e instanceof Error ? e.message : String(e) });
    }
  }
  console.log("bad ref canonical", badRef.length);
  if (badRef.length) console.log(badRef.slice(0, 10));

  let pass = 0;
  let fail = 0;
  const failReasons = new Map<string, number>();
  for (const ref of refs) {
    try {
      const page = await adapter.fetch(ref, {
        source,
        userAgent: "AliceInnovationLibrary/0.1",
        timeoutMs: 30000,
        limit: null,
        fetchText: fetch,
      });
      const draft = adapter.parse(page);
      const reasons = auditDraftShape(draft);
      if (reasons.length === 0) pass += 1;
      else {
        fail += 1;
        for (const r of reasons) failReasons.set(r, (failReasons.get(r) ?? 0) + 1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fail += 1;
      failReasons.set(`throw:${msg}`, (failReasons.get(`throw:${msg}`) ?? 0) + 1);
    }
  }
  console.log("quality_gate_pass", pass, "fail", fail);
  console.log("fail_reasons", [...failReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
