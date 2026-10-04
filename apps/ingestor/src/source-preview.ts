import { evaluateDraftQuality, log } from "@alice/shared";
import type { NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import { saveSourcePreviewReport, type Queryable } from "@alice/database";
import { prepareIngestDraft } from "./prepare-draft.js";

export interface SourcePreviewSample {
  title: string;
  organisation: string | null;
  country: string | null;
  stage: string;
  summary_length: number;
  needs_review: boolean;
  reasons: string[];
  url: string;
}

export interface SourcePreviewReport {
  source_slug: string;
  sample_limit: number;
  sampled: number;
  flagged: number;
  flagged_pct: number;
  samples: SourcePreviewSample[];
}

export function buildSourcePreviewReport(
  source: SourceRecord,
  drafts: NormalisedDraft[],
  limit: number,
): SourcePreviewReport {
  const samples: SourcePreviewSample[] = [];
  let flagged = 0;
  for (const parsed of drafts.slice(0, limit)) {
    const draft = prepareIngestDraft(parsed, source);
    const quality = evaluateDraftQuality(draft);
    if (quality.needsReview) flagged += 1;
    samples.push({
      title: draft.title,
      organisation: draft.organisationName,
      country: draft.countryName,
      stage: draft.evidenceStage,
      summary_length: draft.sourceSummary.trim().length,
      needs_review: quality.needsReview,
      reasons: quality.reasons,
      url: draft.canonicalUrl,
    });
  }
  const sampled = samples.length;
  return {
    source_slug: source.id,
    sample_limit: limit,
    sampled,
    flagged,
    flagged_pct: sampled > 0 ? Math.round((flagged / sampled) * 1000) / 10 : 0,
    samples,
  };
}

export async function persistSourcePreviewReport(
  db: Queryable,
  report: SourcePreviewReport,
): Promise<void> {
  await saveSourcePreviewReport(db, {
    sourceSlug: report.source_slug,
    sampleLimit: report.sample_limit,
    dryRun: true,
    report: report as unknown as Record<string, unknown>,
  });
  log("info", "source_preview_report", {
    source_slug: report.source_slug,
    sampled: report.sampled,
    flagged: report.flagged,
    flagged_pct: report.flagged_pct,
  });
}
