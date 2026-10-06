import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import type { SourceRecord } from "./types.js";

export function appendSourceToRegistryYaml(
  source: SourceRecord,
  file = resolve(process.cwd(), "config/sources.yaml"),
): void {
  const document = parse(readFileSync(file, "utf8")) as { sources?: SourceRecord[] };
  if (!document?.sources || !Array.isArray(document.sources)) {
    throw new Error(`Source registry ${file} has no sources array`);
  }
  if (document.sources.some((row) => row.id === source.id)) {
    return;
  }
  document.sources.push(source);
  writeFileSync(file, stringify(document, { lineWidth: 0 }), "utf8");
}
