import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const WEB_SRC = path.join(process.cwd(), "apps/web/src");

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const BARREL_IMPORT = /from\s+["']@alice\/shared["']/;

test("Next client components and shared UI modules avoid @alice/shared barrel", () => {
  for (const file of walk(WEB_SRC)) {
    const rel = path.relative(WEB_SRC, file);
    const source = readFileSync(file, "utf8");
    const isClient = source.includes('"use client"');
    const isSharedUi = rel.startsWith(`components${path.sep}`);
    if (!isClient && !isSharedUi) continue;
    if (rel.startsWith(`app${path.sep}api${path.sep}`)) continue;
    assert.equal(
      BARREL_IMPORT.test(source),
      false,
      `${rel} must import @alice/shared/text (or server-only paths), not the @alice/shared barrel`,
    );
  }
});
