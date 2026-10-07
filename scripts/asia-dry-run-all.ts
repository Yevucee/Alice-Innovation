import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type Entry = { id: string; seq: number; batch: string };

const queue = JSON.parse(readFileSync(join(process.cwd(), "config/asia-acquisition-queue.json"), "utf8")) as {
  acquisition: Entry[];
  university: Entry[];
};

const slugs = [
  ...queue.acquisition.map((e) => e.id),
  ...queue.university.filter((e) => !e.id.includes("duplicate")).map((e) => e.id),
];

const rows: Array<{ id: string; discovered: number; ok: boolean }> = [];

for (const id of slugs) {
  const result = spawnSync(
    "npm",
    ["run", "adapter:sample-dry-run", "--", `--source=${id}`, "--limit=5"],
    { encoding: "utf8", cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
  );
  const text = `${result.stdout}\n${result.stderr}`;
  const match = text.match(/discovered:\s*(\d+)\s*refs/);
  const discovered = match ? Number(match[1]) : 0;
  rows.push({ id, discovered, ok: discovered > 0 });
  process.stderr.write(`${discovered > 0 ? "OK" : "—"} ${id}: ${discovered}\n`);
}

const ready = rows.filter((r) => r.ok).map((r) => r.id);
const outPath = join(process.cwd(), "docs/asia-adapter-ready-slugs.json");
writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ready, rows }, null, 2)}\n`);
console.log(`\nWrote ${outPath} (${ready.length} ready)`);
