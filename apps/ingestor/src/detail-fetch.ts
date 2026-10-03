import type { SourceRecord } from "@alice/source-registry";
import { fetchText } from "./http.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ingestDetailConcurrency(): number {
  const parsed = Number(process.env.INGEST_DETAIL_CONCURRENCY ?? "4");
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 16) : 4;
}

/** Per-host minimum spacing; safe for parallel workers hitting different hosts. */
export function createHostPacedFetch(
  source: SourceRecord,
  userAgent: string,
  timeoutMs: number,
): (url: string) => Promise<{
  body: string;
  finalUrl: string;
  status: number;
  etag: string | null;
  lastModified: string | null;
}> {
  const minInterval = Math.ceil(60000 / Math.max(1, source.limits.requests_per_minute));
  const hostTail = new Map<string, Promise<unknown>>();

  return (url: string) => {
    const host = new URL(url).hostname;
    const previous = hostTail.get(host) ?? Promise.resolve();
    const request = previous
      .catch(() => undefined)
      .then(async () => {
        const started = Date.now();
        const result = await fetchText(url, { userAgent, timeoutMs });
        const wait = minInterval - (Date.now() - started);
        if (wait > 0) await sleep(wait);
        return result;
      });
    hostTail.set(host, request);
    return request as ReturnType<ReturnType<typeof createHostPacedFetch>>;
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
