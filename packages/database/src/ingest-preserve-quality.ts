import { evaluateDraftQuality, type NormalisedDraft } from "@alice/shared";

export interface ExistingResourceSnapshot {
  canonical_title: string;
  source_summary: string;
  extracted_index_text: string;
  review_status: string;
  review_reason_codes: string[];
}

function draftFromSnapshot(row: ExistingResourceSnapshot): NormalisedDraft {
  return {
    title: row.canonical_title,
    sourceSummary: row.source_summary,
    extractedText: row.extracted_index_text,
    canonicalUrl: "",
    originalUrl: "",
    externalId: "",
    resourceType: "INNOVATION",
    evidenceBasis: "UNKNOWN",
    evidenceStage: "UNKNOWN",
    language: "en",
    tags: [],
    rawMetadata: {},
  };
}

function bodyLength(draft: NormalisedDraft): number {
  const summary = draft.sourceSummary.trim();
  const body = draft.extractedText.trim();
  if (body && body !== summary) return Math.max(summary.length, body.length);
  return summary.length;
}

/**
 * When re-ingesting, never replace clean AUTO_INGESTED content with a worse fetch
 * or downgrade solely because volatile fields shifted.
 */
export function mergeIngestDraftPreservingQuality(
  existing: ExistingResourceSnapshot,
  incoming: NormalisedDraft,
): { draft: NormalisedDraft; treatAsUnchanged: boolean } {
  const existingDraft = draftFromSnapshot(existing);
  const existingQuality = evaluateDraftQuality(existingDraft);
  const incomingQuality = evaluateDraftQuality(incoming);

  if (
    existing.review_status === "AUTO_INGESTED"
    && !existingQuality.needsReview
    && (incomingQuality.needsReview || bodyLength(incoming) < bodyLength(existingDraft))
  ) {
    return { draft: existingDraft, treatAsUnchanged: true };
  }

  let merged: NormalisedDraft = { ...incoming };

  if (bodyLength(incoming) < bodyLength(existingDraft)) {
    merged = {
      ...merged,
      sourceSummary: existing.source_summary,
      extractedText: existing.extracted_index_text,
    };
  }

  if (
    existing.canonical_title.trim().length > incoming.title.trim().length + 8
    && incomingQuality.reasons.includes("truncated_title")
    && !existingQuality.reasons.includes("truncated_title")
  ) {
    merged = { ...merged, title: existing.canonical_title };
  }

  const mergedQuality = evaluateDraftQuality(merged);

  if (
    existing.review_status === "AUTO_INGESTED"
    && !existingQuality.needsReview
    && mergedQuality.needsReview
  ) {
    return {
      draft: existingDraft,
      treatAsUnchanged: true,
    };
  }

  if (
    existing.review_status === "AUTO_INGESTED"
    && !existingQuality.needsReview
    && !mergedQuality.needsReview
    && merged.title === existing.canonical_title
    && merged.sourceSummary === existing.source_summary
    && merged.extractedText === existing.extracted_index_text
  ) {
    return { draft: merged, treatAsUnchanged: true };
  }

  return { draft: merged, treatAsUnchanged: false };
}
