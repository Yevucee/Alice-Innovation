import { evaluateDraftQuality, normaliseAllCapsTitle, type NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import { getAdapter } from "./adapters/registry.js";
import { fetchText, HttpStatusError } from "./http.js";
import type { RunFailureTracker } from "./run-failure-tracker.js";
import { prepareIngestDraft } from "./prepare-draft.js";

const DETAIL_REASONS = new Set(["short_description", "truncated_title", "listing_only_thin"]);

export function draftNeedsQualityDetailFetch(draft: NormalisedDraft): boolean {
  const quality = evaluateDraftQuality(draft);
  return quality.reasons.some((code) => DETAIL_REASONS.has(code));
}

export async function fetchQualityDetailDraft(
  source: SourceRecord,
  draft: NormalisedDraft,
  input: {
    tracker: RunFailureTracker;
    userAgent: string;
    timeoutMs: number;
  },
): Promise<NormalisedDraft | null> {
  const url = draft.canonicalUrl?.trim();
  if (!url) return null;
  const skip = input.tracker.shouldSkipUrl(url);
  if (skip) return null;

  const adapter = getAdapter(source.adapter);
  if (!adapter) return null;

  try {
    const page = await adapter.fetch(
      { url, externalId: draft.externalId, listingHtml: undefined },
      {
        source,
        userAgent: input.userAgent,
        timeoutMs: input.timeoutMs,
        limit: null,
        fetchText: (target) => fetchText(target, { userAgent: input.userAgent, timeoutMs: input.timeoutMs, maxAttempts: 1 }),
      },
    );
    input.tracker.recordSuccess(url);
    const parsed = adapter.parse(page);
    const merged = prepareIngestDraft(
      {
        ...parsed,
        externalId: draft.externalId || parsed.externalId,
        canonicalUrl: draft.canonicalUrl,
        originalUrl: draft.originalUrl,
      },
      source,
    );
    merged.title = normaliseAllCapsTitle(merged.title);
    return merged;
  } catch (error) {
    const status = error instanceof HttpStatusError ? error.status : null;
    input.tracker.recordFailure(url, status);
    return null;
  }
}

export async function enhanceDraftWithQualityDetailIfNeeded(
  source: SourceRecord,
  draft: NormalisedDraft,
  tracker: RunFailureTracker,
): Promise<NormalisedDraft> {
  draft.title = normaliseAllCapsTitle(draft.title);
  if (!draftNeedsQualityDetailFetch(draft)) return draft;
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const enriched = await fetchQualityDetailDraft(source, draft, { tracker, userAgent, timeoutMs });
  return enriched ?? draft;
}
