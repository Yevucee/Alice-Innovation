import { spawnSync } from "node:child_process";
import { ASIA_PRIORITY_WAVE_SLUGS } from "./asia-priority-wave.ts";

const extra = [
  "wavemaker-partners-portfolio",
  "wavemaker-impact-portfolio",
  "accelerating-asia",
  "insignia-ventures-partners",
  "iterative-demo-day",
  "startup-philippines-directory",
  "startup-wheel",
  "techfest-vietnam",
  "1000-startup-digital",
  "indigo-indonesia",
];

const slugs = [...new Set([...ASIA_PRIORITY_WAVE_SLUGS, ...extra])];

type Row = { id: string; discovered: number; ok: boolean };

const rows: Row[] = [];

for (const id of slugs) {
  const result = spawnSync(
    "npm",
    ["run", "adapter:sample-dry-run", "--", `--source=${id}`, "--limit=8"],
    { encoding: "utf8", cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  );
  const text = `${result.stdout}\n${result.stderr}`;
  const match = text.match(/discovered:\s*(\d+)\s*refs/);
  const discovered = match ? Number(match[1]) : 0;
  rows.push({ id, discovered, ok: discovered > 0 });
  console.log(`${discovered > 0 ? "OK" : "—"} ${id}: ${discovered} refs`);
}

const ready = rows.filter((r) => r.ok).map((r) => r.id);
console.log("\nReady for enable:", ready.join(", "));
if (ready.length === 0) process.exitCode = 1;
