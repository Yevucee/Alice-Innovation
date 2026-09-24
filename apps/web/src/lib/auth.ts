import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "alice_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function secret(): string {
  const value = process.env.WEB_SESSION_SECRET || process.env.MCP_AUTH_TOKEN;
  if (!value) throw new Error("WEB_SESSION_SECRET or MCP_AUTH_TOKEN is required for web sessions");
  return value;
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  if (!timingSafeEqual(left, right)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function webAuthPassword(): string {
  return process.env.WEB_AUTH_PASSWORD || process.env.MCP_AUTH_TOKEN || "";
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`;
}
