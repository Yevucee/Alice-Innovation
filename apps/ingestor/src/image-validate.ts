import { isUsableImageUrl, resolvePageImageUrl } from "./adapters/draft.js";

const DEFAULT_MIN_BYTES = 256;
const SKIP_HOST = /(?:^|\.)gravatar\.com$|(?:^|\.)wp\.com$/i;
const SKIP_PATH = /favicon|sprite|1x1|pixel\.|tracking|badge|icon(?:-\d+)?\.(?:png|gif|svg)/i;

export function imageMinBytes(): number {
  const parsed = Number(process.env.IMAGE_MIN_BYTES ?? DEFAULT_MIN_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_BYTES;
}

export function looksLikeDecorativeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (SKIP_HOST.test(parsed.hostname)) return true;
    if (SKIP_PATH.test(parsed.pathname)) return true;
    if (/\.svg(?:$|\?)/i.test(parsed.pathname)) return true;
  } catch {
    return true;
  }
  return false;
}

/** HEAD probe: must be image/* and meet minimum size when Content-Length is present. */
export async function validateRemoteImageUrl(
  url: string,
  options: { userAgent: string; timeoutMs: number; minBytes?: number },
): Promise<boolean> {
  if (!isUsableImageUrl(url) || looksLikeDecorativeImageUrl(url)) return false;
  const minBytes = options.minBytes ?? imageMinBytes();
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": options.userAgent, accept: "image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok) return false;
    const type = response.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/")) return false;
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > 0 && length < minBytes) return false;
    return true;
  } catch {
    return false;
  }
}

export async function resolveValidatedPageImageUrl(
  html: string,
  pageUrl: string,
  options: { userAgent: string; timeoutMs: number; minBytes?: number },
): Promise<string | null> {
  const candidate = resolvePageImageUrl(html, pageUrl);
  if (!candidate) return null;
  const ok = await validateRemoteImageUrl(candidate, options);
  return ok ? candidate : null;
}
