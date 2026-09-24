import { createHash, timingSafeEqual } from "node:crypto";

export function tokensMatch(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function authorised(authorizationHeader: string | undefined, expectedToken: string): boolean {
  if (!expectedToken || !authorizationHeader) return false;
  const match = authorizationHeader.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return false;
  return tokensMatch(match[1], expectedToken);
}

export function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
