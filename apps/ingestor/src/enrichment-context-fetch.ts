import { htmlToText } from "@alice/shared";
import type { Queryable } from "@alice/database";
import {
  loadResourceEnrichmentContext,
  readEnrichmentPageCache,
  writeEnrichmentPageCache,
} from "@alice/database";
import { log } from "@alice/shared";
import { fetchText } from "./http.js";
import { robotsAllows } from "./robots.js";

const hostLastFetch = new Map<string, number>();

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
): Promise<string> {
  if (!url?.trim()) return "";
  const normalized = url.trim();
  if (options.useCache !== false) {
    const cached = await readEnrichmentPageCache(db, normalized);
    if (cached?.extracted_text && cached.extracted_text.length > 80) {
      return cached.extracted_text;
    }
  }
  await throttleHost(normalized);
  const allowed = await robotsPermits(normalized, options.userAgent, options.timeoutMs);
  if (!allowed) {
    log("info", "enrichment_fetch_robots_blocked", { url: normalized });
    return "";
  }
  try {
    const page = await fetchText(normalized, {
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs,
      maxAttempts: 2,
    });
    const text = extractMainText(page.body);
    await writeEnrichmentPageCache(db, normalized, { statusCode: page.status, extractedText: text });
    return text;
  } catch (error) {
    log("warn", "enrichment_fetch_failed", {
      url: normalized,
      message: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

export async function buildSupplementalEnrichmentText(
  db: Queryable,
  resourceId: string,
  options: { userAgent: string; timeoutMs: number },
): Promise<{ supplemental: string; sourceUrl: string | null; orgWebsite: string | null }> {
  const ctx = await loadResourceEnrichmentContext(db, resourceId);
  if (!ctx) return { supplemental: "", sourceUrl: null, orgWebsite: null };
  const parts: string[] = [];
  if (ctx.source_url) {
    const sourceText = await fetchEnrichmentPageText(db, ctx.source_url, options);
    if (sourceText.length > 80) parts.push(`Source page:\n${sourceText}`);
  }
  if (ctx.org_website && ctx.org_website !== ctx.source_url) {
    const orgText = await fetchEnrichmentPageText(db, ctx.org_website, options);
    if (orgText.length > 80) parts.push(`Organisation site:\n${orgText}`);
  }
  return {
    supplemental: parts.join("\n\n").slice(0, 20_000),
    sourceUrl: ctx.source_url,
    orgWebsite: ctx.org_website,
  };
}
