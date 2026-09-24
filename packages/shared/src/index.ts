export { canonicaliseUrl } from "./url.js";
export { sha256, contentHash } from "./hash.js";
export { htmlToText, truncate, normaliseName } from "./text.js";
export { classifyDuplicate, nearDuplicateKey } from "./dedupe.js";
export type { DedupeCandidate, DedupeDecision, DedupeExisting } from "./dedupe.js";
export { reciprocalRankFusion, capPerSource, defaultPerSourceCap } from "./rrf.js";
export type { FusedHit, RankedHit } from "./rrf.js";
export { shouldRetryHttpStatus, isTimeoutError, backoffDelayMs } from "./retry.js";
export { log, loadDotEnv } from "./log.js";
export {
  RESOURCE_TYPES,
  EVIDENCE_STAGES,
  EVIDENCE_BASES,
  REVIEW_STATUSES,
  SOURCE_STATUSES,
  asEvidenceBasis,
  asEvidenceStage,
  asResourceType,
} from "./domain.js";
export type { EvidenceBasis, EvidenceStage, NormalisedDraft, ResourceType } from "./domain.js";
