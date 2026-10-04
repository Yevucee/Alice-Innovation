import {
  mergeColonSplitTitle,
  normaliseCountryDisplayName,
  repairSourceSummary,
  sanitiseOrganisationName,
  truncateAtWordBoundary,
  type NormalisedDraft,
} from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";

/** Ingest-time normalisation for org names, summaries, titles, and country labels. */
export function applyDraftDataQuality(draft: NormalisedDraft, source: SourceRecord): NormalisedDraft {
  const metaDescription =
    typeof draft.rawMetadata?.meta_description === "string" ? draft.rawMetadata.meta_description : null;

  let title = draft.title;
  let summary = draft.sourceSummary;
  const colonMerged = mergeColonSplitTitle(title, summary);
  title = colonMerged.title;
  summary = colonMerged.summary;

  summary = repairSourceSummary({
    title,
    summary,
    bodyText: draft.extractedText,
    metaDescription,
  });

  const priorOrg = draft.organisationName;
  const organisationName = sanitiseOrganisationName(priorOrg, {
    resourceTitle: title,
    sourceName: source.name,
  });

  const rawMetadata = { ...draft.rawMetadata };
  if (priorOrg?.trim() && !organisationName) {
    const reasons = Array.isArray(rawMetadata.quality_reasons)
      ? [...(rawMetadata.quality_reasons as string[])]
      : [];
    if (!reasons.includes("invalid_org_name")) reasons.push("invalid_org_name");
    rawMetadata.quality_reasons = reasons;
    rawMetadata.rejected_organisation_name = priorOrg;
  }

  return {
    ...draft,
    title: truncateAtWordBoundary(title, 300),
    sourceSummary: summary,
    extractedText: truncateAtWordBoundary(draft.extractedText || summary, 1500),
    organisationName,
    countryName: normaliseCountryDisplayName(draft.countryName),
    rawMetadata,
  };
}
