#!/usr/bin/env node
import pg from "pg";
import { loadSources } from "../packages/source-registry/src/load.ts";
import { listAdapters } from "../apps/ingestor/src/adapters/registry.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sources = loadSources(new URL("../config/sources.yaml", import.meta.url).pathname);
const adapters = new Set(listAdapters());

const counts = await pool.query(
  "SELECT slug, item_count::int AS c, status, enabled FROM sources ORDER BY slug",
);
const bySlug = Object.fromEntries(counts.rows.map((r) => [r.slug, r]));

const total = await pool.query("SELECT count(*)::int AS c FROM resources");
console.log(JSON.stringify({ canonical_resources: total.rows[0].c }, null, 2));

const indexed = sources.filter((s) => s.enabled);
const other = sources.filter((s) => !s.enabled);

const thin = [];
const zero = [];
const partialBackfill = [];
for (const s of indexed) {
  const n = bySlug[s.id]?.c ?? 0;
  if (n === 0) zero.push(s.id);
  else if (s.status === "PARTIAL") {
    if (s.id === "hundred" && n < 500) partialBackfill.push({ id: s.id, items: n, note: "~4300 in sitemap" });
    else if (s.id === "oecd-opsi" && n < 900) partialBackfill.push({ id: s.id, items: n, note: "~1083 in WP REST" });
    else if (s.id === "wipo-green" && n < 200) partialBackfill.push({ id: s.id, items: n, note: "API catalogue larger" });
    else if (s.id === "springwise" && n < 50) partialBackfill.push({ id: s.id, items: n, note: "listing-only cap" });
    else if (s.id === "mit-solve" && n < 500) partialBackfill.push({ id: s.id, items: n, note: "sitemap backlog" });
    else if (s.id === "global-resilience-partnership" && n < 100) partialBackfill.push({ id: s.id, items: n, note: "~108 resources" });
    else if (n < 15) thin.push({ id: s.id, items: n });
  }
}

const noAdapter = other.filter((s) => !adapters.has(s.adapter));
const hasAdapterPaused = other.filter((s) => adapters.has(s.adapter));

console.log("\n=== ON SITE (Indexed sources, enabled) ===");
for (const s of indexed.sort((a, b) => (bySlug[a.id]?.c ?? 0) - (bySlug[b.id]?.c ?? 0))) {
  console.log(`${(bySlug[s.id]?.c ?? 0).toString().padStart(5)}  ${s.id}  (${s.status})`);
}

console.log("\n=== NOT INDEXED (Other resources page) ===");
for (const s of other) {
  const ad = adapters.has(s.adapter) ? "adapter-ready" : "no-adapter";
  console.log(`${s.status.padEnd(8)} ${s.id}  ${ad}`);
}

console.log("\n=== ENABLED BUT 0 ITEMS ===", zero.length ? zero.join(", ") : "none");
console.log("\n=== PARTIAL BACKFILL STILL OUTSTANDING ===");
for (const row of partialBackfill) console.log(`  ${row.id}: ${row.items} indexed — ${row.note}`);
for (const row of thin) console.log(`  ${row.id}: ${row.items} indexed (thin)`);

await pool.end();
