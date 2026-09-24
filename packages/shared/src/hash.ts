import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Hash of the source fields that should trigger a re-embed when they change. */
export function contentHash(parts: Array<string | null | undefined>): string {
  return sha256(parts.map((part) => (part ?? "").trim()).join("\n"));
}
