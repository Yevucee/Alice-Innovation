export { canonicaliseUrl } from "./url.js";
export { sha256, contentHash } from "./hash.js";
export { htmlToText, truncate, truncateAtWordBoundary, normaliseName } from "./text.js";
export { convertAllCapsTitleToTitleCase, looksLikeAllCapsTitle } from "./title-case.js";
export { classifyDuplicate, nearDuplicateKey } from "./dedupe.js";
export { evaluateDraftQuality } from "./quality-gate.js";
export type { QualityGateResult } from "./quality-gate.js";
export {
  isLegalFormText,
  isQualityBrowsePandemicJunk,
  sanitizeDisplayTitle,
  sanitizeIngestTitle,
  LEGAL_FORM_ORG_SQL_PATTERN,
  QUALITY_BROWSE_PANDEMIC_PATTERN,
} from "./legal-form.js";
export type { DedupeCandidate, DedupeDecision, DedupeExisting } from "./dedupe.js";
export {
  reciprocalRankFusion,
  capPerBucket,
  capPerSource,
  defaultPerMechanismCap,
  defaultPerSourceCap,
} from "./rrf.js";
export type { FusedHit, RankedHit } from "./rrf.js";
export { shouldRetryHttpStatus, isTimeoutError, backoffDelayMs } from "./retry.js";
export { log, loadDotEnv } from "./log.js";
export {
  embedTexts,
  embedTextsDetailed,
  embeddingSettings,
  embeddingVersion,
  embeddingSupportsDimensionsParam,
  estimateEmbeddingCostUsd,
} from "./embeddings.js";
export type { EmbeddingSettings, EmbeddingUsage, EmbedTextsResult } from "./embeddings.js";
export {
  RESOURCE_TYPES,
  INNOVATION_RESOURCE_TYPES,
  EVIDENCE_STAGES,
  EVIDENCE_BASES,
  REVIEW_STATUSES,
  SOURCE_STATUSES,
  asEvidenceBasis,
  asEvidenceStage,
  asResourceType,
} from "./domain.js";
export type { EvidenceBasis, EvidenceStage, NormalisedDraft, ResourceType } from "./domain.js";
export { normaliseAllCapsTitle } from "./title-case.js";
export {
  isInvalidOrganisationName,
  organisationNameMatchesResourceTitle,
  sanitiseOrganisationName,
} from "./org-name-validator.js";
export type { OrganisationNameContext } from "./org-name-validator.js";
export {
  isSlugLikeSummary,
  summaryEqualsTitle,
  repairSourceSummary,
  mergeColonSplitTitle,
  normaliseCountryDisplayName,
} from "./summary-repair.js";
