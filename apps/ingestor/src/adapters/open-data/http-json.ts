export async function fetchJson<T>(
  url: string,
  init: RequestInit & { userAgent: string; timeoutMs: number },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set("user-agent", init.userAgent);
    if (!headers.has("accept")) headers.set("accept", "application/json");
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 200)}`);
    }
    return JSON.parse(body) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function postJson<T>(
  url: string,
  payload: unknown,
  init: { userAgent: string; timeoutMs: number },
): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    userAgent: init.userAgent,
    timeoutMs: init.timeoutMs,
  });
}

export function listingPageFromJson(ref: { url: string; externalId?: string; listingHtml?: string }, json: unknown): {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  etag: null;
  lastModified: null;
  listingOnly: boolean;
} {
  return {
    url: ref.url,
    finalUrl: ref.url,
    status: 200,
    html: typeof ref.listingHtml === "string" ? ref.listingHtml : JSON.stringify(json),
    etag: null,
    lastModified: null,
    listingOnly: false,
  };
}
