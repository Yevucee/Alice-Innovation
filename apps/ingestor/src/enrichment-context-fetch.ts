import { htmlToText } from "@alice/shared";
import type { Queryable } from "@alice/database";
import {
  loadResourceEnrichmentContext,
  readEnrichmentPageCache,
  writeEnrichmentPageCache,
} from "@alice/database";
import { log } from "@alice/shared";
import { fetchText, HttpStatusError } from "./http.js";
import { robotsAllows } from "./robots.js";

const hostLastFetch = new Map<string, number>();
const host403Streak = new Map<string, number>();
const hostsBlockedForRun = new Set<string>();

export function resetSupplementalFetchHostPolicy(): void {
  host403Streak.clear();
  hostsBlockedForRun.clear();
}

export function isSupplementalHostBlocked(host: string): boolean {
  return hostsBlockedForRun.has(host);
}

/** Returns true once the host is blocked for the rest of the run (after 3 consecutive 403s, or immediately on 401/403/429). */
export function recordSupplementalFetch403(host: string, status = 403): boolean {
  if (status === 401 || status === 403 || status === 429) {
    hostsBlockedForRun.add(host);
    log("info", "enrichment_supplemental_host_blocked", {
      host,
      consecutive_403: host403Streak.get(host) ?? 0,
      http_status: status,
    });
    return true;
  }
  const streak = (host403Streak.get(host) ?? 0) + 1;
  host403Streak.set(host, streak);
  if (streak >= 3 && !hostsBlockedForRun.has(host)) {
    hostsBlockedForRun.add(host);
    log("info", "enrichment_supplemental_host_blocked", {
      host,
      consecutive_403: streak,
      blocked_hosts: [...hostsBlockedForRun],
    });
  }
  return hostsBlockedForRun.has(host);
}

function noteSupplementalFetchSuccess(host: string): void {
  host403Streak.set(host, 0);
}

function minIntervalMs(): number {
  const raw = process.env.ENRICH_FETCH_MIN_INTERVAL_MS;
  if (raw == null || raw === "") return 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : 1000;
}

async function throttleHost(url: string): Promise<void> {
  const host = new URL(url).host;
  const wait = minIntervalMs();
  const last = hostLastFetch.get(host) ?? 0;
  const delay = Math.max(0, last + wait - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  hostLastFetch.set(host, Date.now());
}

async function robotsPermits(url: string, userAgent: string, timeoutMs: number): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", url).toString();
    const robots = await fetchText(robotsUrl, { userAgent, timeoutMs, maxAttempts: 1 });
    const path = new URL(url).pathname;
    return robotsAllows(robots.body, userAgent, path).allowed;
  } catch {
    return true;
  }
}

function extractMainText(html: string): string {
  const withoutScripts = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const article = withoutScripts.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main = withoutScripts.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const body = article ?? main ?? withoutScripts;
  return htmlToText(body).slice(0, 12_000);
}

export async function fetchEnrichmentPageText(
  db: Queryable,
  url: string,
  options: { userAgent: string; timeoutMs: number; useCache?: boolean },
): Promise<{ text: string; networkFetch: boolean }> {
  if (!url?.trim()) return { text: "", networkFetch: false };
  const normalized = url.trim();
  const host = new URL(normalized).host;
  if (isSupplementalHostBlocked(host)) {
    return { text: "", networkFetch: false };
  }
  if (options.useCache !== false) {
    const cached = await readEnrichmentPageCache(db, normalized);
    if (cached?.extracted_text && cached.extracted_text.length > 80) {
      return { text: cached.extracted_text, networkFetch: false };
    }
  }
  await throttleHost(normalized);
  const allowed = await robotsPermits(normalized, options.userAgent, options.timeoutMs);
  if (!allowed) {
    log("info", "enrichment_fetch_robots_blocked", { url: normalized });
    return { text: "", networkFetch: false };
  }
  try {
    const page = await fetchText(normalized, {
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs,
      maxAttempts: 2,
    });
    noteSupplementalFetchSuccess(host);
    const text = extractMainText(page.body);
    await writeEnrichmentPageCache(db, normalized, { statusCode: page.status, extractedText: text });
    return { text, networkFetch: true };
  } catch (error) {
    if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403 || error.status === 429)) {
      recordSupplementalFetch403(host, error.status);
      log("warn", "enrichment_fetch_failed", {
        url: normalized,
        status: error.status,
        host,
      });
      return { text: "", networkFetch: false };
    }
    log("warn", "enrichment_fetch_failed", {
      url: normalized,
      message: error instanceof Error ? error.message : String(error),
    });
    return { text: "", networkFetch: false };
  }
}

export async function buildSupplementalEnrichmentText(
  db: Queryable,
  resourceId: string,
  options: { userAgent: string; timeoutMs: number },
): Promise<{ supplemental: string; sourceUrl: string | null; orgWebsite: string | null; pagesFetched: number }> {
  const ctx = await loadResourceEnrichmentContext(db, resourceId);
  if (!ctx) return { supplemental: "", sourceUrl: null, orgWebsite: null, pagesFetched: 0 };
  const parts: string[] = [];
  let pagesFetched = 0;
  if (ctx.source_url) {
    const sourceText = await fetchEnrichmentPageText(db, ctx.source_url, options);
    if (sourceText.networkFetch) pagesFetched += 1;
    if (sourceText.text.length > 80) parts.push(`Source page:\n${sourceText.text}`);
  }
  if (ctx.org_website && ctx.org_website !== ctx.source_url) {
    const orgText = await fetchEnrichmentPageText(db, ctx.org_website, options);
    if (orgText.networkFetch) pagesFetched += 1;
    if (orgText.text.length > 80) parts.push(`Organisation site:\n${orgText.text}`);
  }
  return {
    supplemental: parts.join("\n\n").slice(0, 20_000),
    sourceUrl: ctx.source_url,
    orgWebsite: ctx.org_website,
    pagesFetched,
  };
}
