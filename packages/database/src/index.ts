export { getPool, closePool } from "./pool.js";
export type { Queryable } from "./pool.js";
export { applyMigrations } from "./migrate.js";
export { seedSources, seedTaxonomy } from "./seed.js";
export {
  upsertDraft,
  saveEmbedding,
  noteSemanticDuplicate,
  confirmDisappearances,
  readCheckpoint,
  writeCheckpoint,
} from "./ingest.js";
export type { UpsertDraftOptions, UpsertResult } from "./ingest.js";
export { linkResourceTaxonomy } from "./taxonomy-links.js";
export {
  searchLibrary,
  getResource,
  findSimilar,
  countFilteredResources,
  compactResourcesByIds,
} from "./search.js";
export type { CompactResource, SearchFilters } from "./search.js";
export { searchWithEmbedding } from "./search-with-embedding.js";
export type { EmbedTextsFn } from "./search-with-embedding.js";
export {
  buildEmbeddingText,
  embeddingTextContentHash,
  loadResourcesForEmbedding,
  countActiveResources,
  embeddingCatalogueCoverage,
} from "./embedding-text.js";
export type { EmbeddingTextInput, ResourceEmbeddingRow } from "./embedding-text.js";
export {
  runEmbeddingBackfill,
  runEmbeddingBackfillForResourceIds,
  runEmbeddingSafetyCheck,
  recordEmbeddingBackfillRun,
  latestEmbeddingBackfillRun,
  embeddingAdminStatus,
  verifyEmbeddingSafetySample,
} from "./embedding-backfill.js";
export type { EmbeddingBackfillSummary, EmbeddingBackfillRunOptions } from "./embedding-backfill.js";
export {
  runQualityAudit,
  auditDraftShape,
  qualityAdminStatus,
  summariseReasonCounts,
  type QualityAuditRow,
  type QualityAuditSummary,
} from "./quality-audit.js";
export {
  loadEnrichmentCandidates,
  applyEnrichmentToResource,
  enrichmentAdminStatus,
  enrichmentInputHash,
  readEnrichmentCache,
  writeEnrichmentCache,
  recordEnrichmentRun,
  recordResourceEnrichmentAttempt,
  parseEnrichmentPayload,
  parseEnrichmentMessageContent,
  type EnrichmentPayload,
  type EnrichmentOutcome,
  type ApplyEnrichmentResult,
} from "./enrichment.js";
export {
  listRecentResources,
  resourcesForTaxonomy,
  resourcesForSource,
  resourcesFromAfrica,
  getPerson,
  getOrganisation,
  diverseApproachesForResource,
  listRecentIngestionRuns,
} from "./browse.js";
export {
  libraryStats,
  browseSources,
  sourceStatus,
  browseCategories,
  searchPeople,
  searchOrganisations,
} from "./stats.js";
export {
  listCollections,
  getCollectionBySlug,
  createCollection,
  addResourceToCollection,
  addCollectionNote,
  collectionWithResources,
} from "./collections.js";
export {
  hashAccessToken,
  storeAccessToken,
  validateStoredAccessToken,
  purgeExpiredAccessTokens,
} from "./mcp-oauth.js";
export {
  upsertInnovationHub,
  recordHubDirectoryDiscovery,
  upsertSourceCandidate,
  hubDiscoveryStats,
  websiteHost,
} from "./hubs.js";
export type { HubSubtype, CatalogueCapability, HubUpsertInput } from "./hubs.js";
