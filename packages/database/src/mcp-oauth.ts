import { createHash } from "node:crypto";
import type { Queryable } from "./pool.js";

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function storeAccessToken(
  db: Queryable,
  token: string,
  clientId: string,
  expiresAt: Date,
  scopes: string[] = ["mcp"],
): Promise<void> {
  await db.query(
    `INSERT INTO mcp_access_tokens (token_hash, client_id, scopes, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [hashAccessToken(token), clientId, scopes, expiresAt],
  );
}

export async function validateStoredAccessToken(db: Queryable, token: string): Promise<boolean> {
  const row = await db.query<{ ok: number }>(
    `SELECT 1 AS ok FROM mcp_access_tokens
     WHERE token_hash = $1 AND expires_at > now()`,
    [hashAccessToken(token)],
  );
  return Boolean(row.rows[0]?.ok);
}

export async function purgeExpiredAccessTokens(db: Queryable): Promise<number> {
  const row = await db.query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM mcp_access_tokens WHERE expires_at <= now() RETURNING 1
     ) SELECT count(*)::text AS count FROM deleted`,
  );
  return Number(row.rows[0]?.count ?? 0);
}
