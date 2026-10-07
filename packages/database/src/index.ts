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
export {
  listingContentHash,
  ingestDetailRefetchDays,
  ingestDetailBootstrapDays,
  shouldSkipDetailFetch,
  loadSourceItemListingStateMap,
  lookupListingState,
  touchSourceItemWithoutDetailFetch,
  markInterruptedIngestionRuns,
} from "./ingest-detail.js";
export type { ListingRef, SourceItemListingState } from "./ingest-detail.js";
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
  qualityReviewBreakdown,
  backfillReviewReasonCodesBatch,
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
  countEnrichmentGaps,
  formatEnrichmentGapNote,
} from "./enrichment-gaps.js";
export type { EnrichmentGapCounts } from "./enrichment-gaps.js";
export {
  loadResourceEnrichmentContext,
  readEnrichmentPageCache,
  writeEnrichmentPageCache,
  supplementalTextFromPageCache,
} from "./enrichment-context.js";
export type { ResourceEnrichmentContext } from "./enrichment-context.js";
export {
  completePostDeployJob,
  getActivePostDeployJob,
  hasPendingPostDeployJobs,
  listActivePostDeployJobs,
  listPostDeployJobs,
  markPostDeployJobInProgress,
  notePostDeployJobError,
  setPostDeployJobLastRun,
  updatePostDeployJobProgress,
  type PostDeployJobRow,
  type PostDeployJobStatus,
} from "./post-deploy-jobs.js";
export {
  loadPostDeployJobsAdmin,
  postDeployJobsAdminPanel,
  postDeployLastRunBudget,
  summarisePostDeployJobCounters,
  summarisePostDeployJobSkipped,
  type PostDeployJobAdminRow,
  type PostDeployLastRunBudget,
} from "./post-deploy-admin.js";
export { asiaIngestAdminSummary, type AsiaIngestAdminSummary, type AsiaSourceIngestRow } from "./asia-ingest-admin.js";
export {
  resourcesMissingImageAdminSummary,
  type ResourcesMissingImageAdminSummary,
} from "./image-admin.js";
export {
  primaryProgressOffset,
  readLastRunFromProgress,
  mergeLastRunIntoProgress,
  type PostDeployJobLastRun,
  type PostDeployJobStopReason,
} from "./post-deploy-run-summary.js";
export {
  runNeedsReviewReconcileBatch,
  loadNeedsReviewReconcileBatch,
  evaluateResourceQuality,
  shouldAcceptSourceLimited,
  countNeedsReview,
  type NeedsReviewReconcileBatchResult,
} from "./needs-review-reconcile.js";
export { runAllCapsTitleRepairBatch } from "./title-case-repair.js";
export {
  startQualityReviewBacklogRun,
  completeQualityReviewBacklogRun,
  latestQualityReviewBacklogRun,
  sampleNeedsReviewBySources,
  type QualityReviewBacklogRunRow,
} from "./quality-review-backlog.js";
export {
  inferStageFromText,
  normaliseEnrichmentStageLabel,
  stageFromAdapterMetadata,
} from "./enrichment-stage.js";
export {
  runDataQualityRepairBatch,
  retypeApoliticalArticles,
  type DataQualityRepairCounts,
  type DataQualityRepairBatchResult,
} from "./data-quality-repair.js";
export {
  runRestoreTitleMatchedOrganisationsBatch,
  type RestoreTitleMatchedOrgsBatchResult,
} from "./org-title-restore.js";
export {
  loadOrgRecoveryCandidates,
  linkRecoveredOrganisation,
  organisationFromStoredMetadata,
  acceptRecoveredOrganisationName,
} from "./org-recovery-from-source.js";
export {
  loadQualityContentBackfillCandidates,
  applyQualityContentUpdate,
} from "./quality-content-backfill.js";
export {
  saveSourcePreviewReport,
  latestSourcePreviewReports,
  type SourcePreviewReportRow,
} from "./source-preview.js";
export { EXCLUDE_ARTICLE_RESOURCE_SQL } from "./innovation-resource-filter.js";
export {
  correctMisassignedWaterSectorTags,
  invalidateStaleEnrichmentEmbeddings,
  isJunkPersonName,
  isLegalFormOrganisationName,
  loadResourceIdsNeedingReembed,
  mergeDuplicateOrganisations,
  repairLegalFormOrganisationLinks,
  resolveOrganisationId,
  repairMarkdownHashTitles,
} from "./data-repair.js";
export {
  listRecentResources,
  resourcesForTaxonomy,
  resourcesForSource,
  resourcesFromAfrica,
  resourcesFromAsia,
  randomQualityBrowseResource,
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
  insertSourceCandidate,
  listSourceCandidates,
  countSourceCandidates,
  getSourceCandidate,
  promoteSourceCandidateToIngest,
  normalizeCandidateUrl,
  defaultCandidateName,
  findSourceCandidateByHomepage,
  type SourceCandidateRow,
} from "./source-candidates.js";
export {
  inferPromotedCatalogueConfig,
  loadPromotedCatalogueConfigs,
  loadPromotedSourceRecords,
  uniquePromotedSourceSlug,
  type PromotedCatalogueConfigRow,
} from "./promoted-sources.js";
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
