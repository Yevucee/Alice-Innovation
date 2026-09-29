import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { getPool, purgeExpiredAccessTokens, storeAccessToken } from "@alice/database";

interface OAuthClient {
  secret: string;
  name?: string;
}

function parseClients(): Record<string, OAuthClient> {
  const raw = process.env.MCP_OAUTH_CLIENTS;
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, OAuthClient>;
  } catch {
    return {};
  }
}

function secretsMatch(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function oauthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    token_endpoint: `${baseUrl}/oauth/token`,
    grant_types_supported: ["client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    scopes_supported: ["mcp"],
  };
}

export async function issueClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clients = parseClients();
  const client = clients[clientId];
  if (!client || !secretsMatch(clientSecret, client.secret)) return null;
  const token = randomBytes(32).toString("base64url");
  const ttlSec = Number(process.env.MCP_OAUTH_TOKEN_TTL_SEC || 86400);
  const expiresAt = new Date(Date.now() + ttlSec * 1000);
  await purgeExpiredAccessTokens(getPool());
  await storeAccessToken(getPool(), token, clientId, expiresAt, ["mcp"]);
  return { access_token: token, expires_in: ttlSec };
}

export function readTokenRequest(body: unknown): { clientId: string; clientSecret: string } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const grant = String(record.grant_type ?? "");
  if (grant !== "client_credentials") return null;
  const clientId = String(record.client_id ?? "").trim();
  const clientSecret = String(record.client_secret ?? "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function publicBaseUrl(req: Request): string {
  const configured = process.env.MCP_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol;
  return `${proto}://${host}`;
}

export function hashForLog(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}
