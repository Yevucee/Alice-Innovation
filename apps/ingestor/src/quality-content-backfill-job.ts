import {
  applyQualityContentUpdate,
  loadQualityContentBackfillCandidates,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { evaluateDraftQuality, log, normaliseAllCapsTitle } from "@alice/shared";
import { loadSources } from "@alice/source-registry";
import { getAdapter } from "./adapters/registry.js";
import { prepareIngestDraft } from "./prepare-draft.js";
import { fetchQualityDetailDraft } from "./quality-detail-fetch.js";
import type { RunFailureTracker } from "./run-failure-tracker.js";

export async function runQualityContentBackfillBatch(
  db: Queryable,
  input: { offset: number; tracker: RunFailureTracker },
): Promise<{
  scanned: number;
  updated: number;
  reembed_resource_ids: string[];
  next_offset: number;
  complete: boolean;
}> {
  const rows = await loadQualityContentBackfillCandidates(db, input.offset);
  const userAgent = process.env.INGESTION_USER_AGENT
    || "AliceInnovationLibrary/0.1 (+https://github.com/Yevucee/Alice-Innovation)";
  const timeoutMs = Number(process.env.INGESTION_REQUEST_TIMEOUT_MS || 20000);
  const sources = loadSources();
  let updated = 0;
  const reembed_resource_ids: string[] = [];

  for (const row of rows) {
    const source = sources.find((entry) => entry.id === row.source_slug);
    if (!source) continue;
    const adapter = getAdapter(source.adapter);
    if (!adapter) continue;

    const baseDraft = prepareIngestDraft(
      {
        resourceType: "SOLUTION",
        title: normaliseAllCapsTitle(row.title),
        sourceSummary: row.source_summary,
        extractedText: row.extracted_index_text,
        externalId: row.resource_id,
        canonicalUrl: row.canonical_url,
        originalUrl: row.canonical_url,
        language: "en",
        imageUrl: null,
        publishedAt: null,
        organisationName: null,
        personName: null,
        countryName: null,
        countryCode: null,
        continentName: null,
        tags: [],
        evidenceStage: "UNKNOWN",
        evidenceBasis: "UNKNOWN",
        maturityStage: "UNKNOWN",
        costLevel: "UNKNOWN",
        commercialStatus: "UNKNOWN",
        rawMetadata: {},
        etag: null,
        lastModified: null,
      },
      source,
    );

    const enriched =
      (await fetchQualityDetailDraft(source, baseDraft, {
        tracker: input.tracker,
        userAgent,
        timeoutMs,
      })) ?? baseDraft;

    const quality = evaluateDraftQuality(enriched);
    const reasons = quality.needsReview ? quality.reasons : [];
    const clearReview = !quality.needsReview;

    await applyQualityContentUpdate(db, {
      resourceId: row.resource_id,
      title: enriched.title,
      summary: enriched.sourceSummary,
      bodyText: enriched.extractedText,
      reviewReasonCodes: reasons,
      clearReview,
    });
    updated += 1;
    reembed_resource_ids.push(row.resource_id);
  }

  const next_offset = input.offset + rows.length;
  log("info", "quality_detail_backfill_batch", { scanned: rows.length, updated, offset: input.offset });
  return {
    scanned: rows.length,
    updated,
    reembed_resource_ids,
    next_offset,
    complete: rows.length === 0,
  };
}
