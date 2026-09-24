import { backoffDelayMs, isTimeoutError, log, shouldRetryHttpStatus } from "@alice/shared";

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  body: string;
  etag: string | null;
  lastModified: string | null;
}

export class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(
  url: string,
  options: { userAgent: string; timeoutMs: number; maxAttempts?: number },
): Promise<FetchResult> {
  const attempts = options.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": options.userAgent,
          accept: "text/html,application/xml,text/xml,application/json;q=0.9,*/*;q=0.8",
        },
      });
      const body = await response.text();
      if (!response.ok) {
        const error = new HttpStatusError(`HTTP ${response.status} for ${url}`, response.status, url);
        if (!shouldRetryHttpStatus(response.status) || attempt === attempts) throw error;
        lastError = error;
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15000)
          : backoffDelayMs(attempt);
        log("warn", "http_retry", { url, status: response.status, attempt, delay_ms: delay });
        await sleep(delay);
        continue;
      }
      return {
        url,
        finalUrl: response.url || url,
        status: response.status,
        body,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    } catch (error) {
      if (error instanceof HttpStatusError) throw error;
      lastError = error;
      const aborted = error instanceof Error && error.name === "AbortError";
      if (!(aborted || isTimeoutError(error)) || attempt === attempts) {
        throw error;
      }
      const delay = backoffDelayMs(attempt);
      log("warn", "http_retry", { url, attempt, delay_ms: delay, error: "timeout" });
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}
