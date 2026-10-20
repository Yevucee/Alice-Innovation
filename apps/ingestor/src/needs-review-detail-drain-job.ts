import {
  applyDetailDrainOutcome,
  classifyDetailDrainOutcome,
  detailDrainModeWrites,
  detailDrainRequiresSuccessfulFetch,
  loadNeedsReviewDetailDrainBatch,
  NEEDS_REVIEW_DETAIL_DRAIN_SAMPLE_LIMIT,
  proposeDetailDrainFields,
  type DetailDrainSourceCounts,
  type NeedsReviewDetailDrainBatchResult,
  type NeedsReviewDetailDrainSample,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { evaluateDraftQuality, log, normaliseAllCapsTitle, type NormalisedDraft } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { prepareIngestDraft } from "./prepare-draft.js";
import { fetchQualityDetailDraft } from "./quality-detail-fetch.js";
import type { RunFailureTracker } from "./run-failure-tracker.js";

const DETAIL_FETCH_DELAY_MS = Number(process.env.NEEDS_REVIEW_DETAIL_DRAIN_DELAY_MS || 350);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DetailDrainRowPlan =
  | { kind: "fetch_failed" }
  | {
      kind: "classify";
      draft: NormalisedDraft;
      fixed: ReturnType<typeof proposeDetailDrainFields>;
      outcome: ReturnType<typeof classifyDetailDrainOutcome>;
      qualityNeedsReview: boolean;
    };

/** Pure planning step for tests: when fetch is required but failed, do not classify or write. */
export function planDetailDrainRow(
  sourceSlug: string | null,
  fetchSucceeded: boolean,
  row: { title: string; source_summary: string; extracted_index_text: string },
  enriched: NormalisedDraft,
): DetailDrainRowPlan | null {
  if (detailDrainRequiresSuccessfulFetch(sourceSlug) && !fetchSucceeded) {
    return { kind: "fetch_failed" };
  }
  const bulkRow = {
    id: "",
    title: row.title,
    source_summary: row.source_summary,
    extracted_index_text: row.extracted_index_text,
    organisation_name: null,
    person_name: null,
    raw_metadata: {},
    source_slug: sourceSlug,
    source_item_title: null,
    source_external_id: null,
    canonical_url: null,
  };
  const fixed = proposeDetailDrainFields(bulkRow, {
    title: enriched.title,
    sourceSummary: enriched.sourceSummary,
    extractedText: enriched.extractedText,
  });
  const outcome = classifyDetailDrainOutcome(bulkRow, fixed);
  const quality = evaluateDraftQuality({
    ...enriched,
    title: fixed.title,
    sourceSummary: fixed.source_summary,
    extractedText: fixed.extracted_index_text,
  });
  return {
    kind: "classify",
    draft: enriched,
    fixed,
    outcome,
    qualityNeedsReview: quality.needsReview,
  };
}

function emptySourceCounts(): DetailDrainSourceCounts {
  return { repaired: 0, cleared: 0, source_limited: 0, still_flagged: 0, fetch_failed: 0 };
}

export async function runNeedsReviewDetailDrainBatch(
  db: Queryable,
  afterId: string | null,
  input: {
    tracker: RunFailureTracker;
    maxSamples?: number;
    existingSampleCount?: number;
    existingBySource?: Record<string, DetailDrainSourceCounts>;
  },
): Promise<NeedsReviewDetailDrainBatchResult> {
  const apply = detailDrainModeWrites();
  const rows = await loadNeedsReviewDetailDrainBatch(db, afterId);
  const sources = loadSources();
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);

  let repaired = 0;
  let cleared = 0;
  let source_limited = 0;
  let still_flagged = 0;
  let fetch_failed = 0;
  const reembed_resource_ids: string[] = [];
  const by_source: Record<string, DetailDrainSourceCounts> = { ...(input.existingBySource ?? {}) };
  const samples: NeedsReviewDetailDrainSample[] = [];
  const sampleBudget = Math.max(0, (input.maxSamples ?? NEEDS_REVIEW_DETAIL_DRAIN_SAMPLE_LIMIT) - (input.existingSampleCount ?? 0));

  const bump = (slug: string, field: keyof DetailDrainSourceCounts) => {
    const key = slug || "unknown";
    if (!by_source[key]) {
      by_source[key] = emptySourceCounts();
    }
    by_source[key][field] += 1;
  };

  const maybeSample = (
    row: { id: string; source_slug: string | null; canonical_url: string | null; title: string },
    fixedTitle: string,
    action: string,
  ) => {
    if (samples.length >= sampleBudget) return;
    if (row.title === fixedTitle && action === "unchanged") return;
    samples.push({
      resource_id: row.id,
      source_slug: row.source_slug,
      canonical_url: row.canonical_url,
      action,
      title_before: row.title,
      title_after: fixedTitle,
    });
  };

  for (const row of rows) {
    const slug = row.source_slug ?? "unknown";
    const source = sources.find((entry) => entry.id === row.source_slug);
    if (!source) {
      still_flagged += 1;
      bump(slug, "still_flagged");
      continue;
    }

    const baseDraft = prepareIngestDraft(
      {
        resourceType: "SOLUTION",
        title: normaliseAllCapsTitle(row.title),
        sourceSummary: row.source_summary,
        extractedText: row.extracted_index_text,
        externalId: row.source_external_id ?? row.id,
        canonicalUrl: row.canonical_url ?? "",
        originalUrl: row.canonical_url ?? "",
        language: "en",
        imageUrl: null,
        publishedAt: null,
        organisationName: row.organisation_name,
        personName: row.person_name,
        countryName: null,
        countryCode: null,
        continentName: null,
        tags: [],
        evidenceStage: "UNKNOWN",
        evidenceBasis: "UNKNOWN",
        maturityStage: "UNKNOWN",
        costLevel: "UNKNOWN",
        commercialStatus: "UNKNOWN",
        rawMetadata: row.raw_metadata ?? {},
        etag: null,
        lastModified: null,
      },
      source,
    );

    const requiresFetch = detailDrainRequiresSuccessfulFetch(row.source_slug);
    let draftForClassify: NormalisedDraft;

    if (requiresFetch) {
      const fetched =
        (await fetchQualityDetailDraft(source, baseDraft, {
          tracker: input.tracker,
          userAgent,
          timeoutMs,
        })) ?? null;
      if (!fetched) {
        fetch_failed += 1;
        bump(slug, "fetch_failed");
        if (DETAIL_FETCH_DELAY_MS > 0) await sleep(DETAIL_FETCH_DELAY_MS);
        continue;
      }
      draftForClassify = fetched;
    } else {
      draftForClassify = baseDraft;
    }

    const fixed = proposeDetailDrainFields(row, {
      title: draftForClassify.title,
      sourceSummary: draftForClassify.sourceSummary,
      extractedText: draftForClassify.extractedText,
    });
    const outcome = classifyDetailDrainOutcome(row, fixed);
    const quality = evaluateDraftQuality({
      ...draftForClassify,
      title: fixed.title,
      sourceSummary: fixed.source_summary,
      extractedText: fixed.extracted_index_text,
    });

    if (outcome.repaired) {
      repaired += 1;
      bump(slug, "repaired");
    }

    if (outcome.action === "cleared") {
      cleared += 1;
      bump(slug, "cleared");
      maybeSample(row, fixed.title, "cleared");
      if (apply) {
        await applyDetailDrainOutcome(db, row, fixed, outcome);
        reembed_resource_ids.push(row.id);
      }
    } else if (outcome.action === "source_limited") {
      source_limited += 1;
      bump(slug, "source_limited");
      maybeSample(row, fixed.title, "source_limited");
      if (apply) {
        await applyDetailDrainOutcome(db, row, fixed, outcome);
        reembed_resource_ids.push(row.id);
      }
    } else if (outcome.action === "still_flagged" || outcome.action === "unchanged") {
      still_flagged += 1;
      bump(slug, "still_flagged");
      const action = quality.needsReview ? "still_flagged" : "unchanged";
      maybeSample(row, fixed.title, action);
    }

    if (DETAIL_FETCH_DELAY_MS > 0) await sleep(DETAIL_FETCH_DELAY_MS);
  }

  const nextLastId = rows.length > 0 ? rows[rows.length - 1].id : afterId;
  log("info", "needs_review_detail_drain_batch", {
    scanned: rows.length,
    repaired,
    cleared,
    source_limited,
    still_flagged,
    fetch_failed,
    after_id: afterId,
  });

  return {
    scanned: rows.length,
    repaired,
    cleared,
    source_limited,
    still_flagged,
    fetch_failed,
    last_id: afterId,
    next_last_id: nextLastId,
    complete: rows.length === 0,
    reembed_resource_ids,
    by_source,
    samples,
  };
}
