import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Collapse whitespace so minor HTML/text normalisation does not force re-ingest. */
export function normalizeTextForContentHash(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/** Hash of the source fields that should trigger a re-embed when they change. */
export function contentHash(parts: Array<string | null | undefined>): string {
  return sha256(parts.map((part) => normalizeTextForContentHash(part)).join("\n"));
}
