import { createHash, timingSafeEqual } from "node:crypto";
import { validateStoredAccessToken } from "@alice/database";
import type { Queryable } from "@alice/database";

export function tokensMatch(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function bearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

export function authorised(authorizationHeader: string | undefined, expectedToken: string): boolean {
  const token = bearerToken(authorizationHeader);
  if (!token) return false;
  if (expectedToken && tokensMatch(token, expectedToken)) return true;
  return false;
}

export async function authorisedMcp(
  db: Queryable,
  authorizationHeader: string | undefined,
  expectedToken: string,
): Promise<boolean> {
  const token = bearerToken(authorizationHeader);
  if (!token) return false;
  if (expectedToken && tokensMatch(token, expectedToken)) return true;
  if (process.env.MCP_OAUTH_ENABLED === "true") {
    return validateStoredAccessToken(db, token);
  }
  return false;
}

export function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
