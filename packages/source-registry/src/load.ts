import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { SourceRecord } from "./types.js";

export function loadSources(file = resolve(process.cwd(), "config/sources.yaml")): SourceRecord[] {
  const document = parse(readFileSync(file, "utf8")) as { sources?: SourceRecord[] };
  if (!document?.sources || !Array.isArray(document.sources)) {
    throw new Error(`Source registry ${file} has no sources array`);
  }
  const ids = new Set<string>();
  for (const source of document.sources) {
    if (!source.id || !source.homepage || !source.adapter) {
      throw new Error(`Source registry entry is missing id, homepage, or adapter`);
    }
    if (ids.has(source.id)) throw new Error(`Duplicate source id ${source.id}`);
    ids.add(source.id);
    if (source.collection_url !== null && source.collection_url !== undefined) {
      const url = new URL(source.collection_url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`Collection URL for ${source.id} is not http(s)`);
      }
    }
    new URL(source.homepage);
  }
  return document.sources;
}

export function findSource(sources: SourceRecord[], id: string): SourceRecord | undefined {
  return sources.find((source) => source.id === id);
}
