const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function shouldRetryHttpStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    /timeout/i.test(message)
  );
}

export function backoffDelayMs(attempt: number, baseMs = 500, capMs = 8000): number {
  const exponential = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(exponential * 0.2 * Math.random());
  return exponential + jitter;
}
