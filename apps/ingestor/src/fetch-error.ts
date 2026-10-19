/** Max length for fetch failure strings stored in DB logs and summaries. */
export const FETCH_ERROR_FORMAT_MAX_LEN = 240;

type ErrnoLike = Error & {
  code?: string;
  errno?: number | string;
  syscall?: string;
  hostname?: string;
};

function isErrnoLike(value: unknown): value is ErrnoLike {
  return value instanceof Error;
}

/** Remove query strings and hashes from URLs embedded in a message. */
export function stripUrlQueryStrings(text: string): string {
  return text.replace(/https?:\/\/[^\s)'"]+/gi, (raw) => {
    try {
      const parsed = new URL(raw);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      const q = raw.indexOf("?");
      const h = raw.indexOf("#");
      const end = Math.min(q >= 0 ? q : raw.length, h >= 0 ? h : raw.length);
      return raw.slice(0, end);
    }
  });
}

function errnoDetail(error: ErrnoLike): string {
  const parts: string[] = [];
  if (error.code) parts.push(error.code);
  if (error.syscall) parts.push(error.syscall);
  if (error.hostname) parts.push(error.hostname);
  else if (error.errno != null && parts.length === 0) parts.push(String(error.errno));
  if (parts.length === 0) {
    const msg = error.message.trim();
    if (msg) parts.push(msg);
  }
  return parts.join(" ");
}

function truncateFormatted(text: string, maxLen = FETCH_ERROR_FORMAT_MAX_LEN): string {
  const cleaned = stripUrlQueryStrings(text);
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3)}...`;
}

/**
 * Format fetch/network errors for ingestion_runs and ingestion_errors.
 * Walks Error.cause and includes code / syscall / hostname when present.
 */
export function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return truncateFormatted(String(error));
  }

  const causeParts: string[] = [];
  const seen = new Set<string>();
  let current: unknown = error.cause;
  for (let depth = 0; depth < 4 && current != null; depth += 1) {
    if (isErrnoLike(current)) {
      const detail = errnoDetail(current);
      if (detail && !seen.has(detail)) {
        seen.add(detail);
        causeParts.push(detail);
      }
      current = current.cause;
      continue;
    }
    const asString = String(current).trim();
    if (asString && !seen.has(asString)) {
      seen.add(asString);
      causeParts.push(asString);
    }
    break;
  }

  const top = error as ErrnoLike;
  if (causeParts.length === 0 && (top.code || top.syscall || top.hostname)) {
    const selfDetail = errnoDetail(top);
    if (selfDetail && !seen.has(selfDetail)) causeParts.push(selfDetail);
  }

  let message = error.message.trim() || error.name || "Error";
  if (causeParts.length > 0) {
    const causeStr = causeParts.join(" -> ");
    if (!message.includes(causeStr)) {
      message = `${message} (cause: ${causeStr})`;
    }
  }

  return truncateFormatted(message);
}

/** Rethrow preserving the original error and its cause chain. */
export function rethrowFetchError(lastError: unknown, contextUrl: string): never {
  if (lastError instanceof Error) {
    throw lastError;
  }
  const urlWithoutQuery = stripUrlQueryStrings(contextUrl);
  throw new Error(`Failed to fetch ${urlWithoutQuery}`, { cause: lastError });
}
