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
export { searchLibrary, getResource, findSimilar, countFilteredResources } from "./search.js";
export type { CompactResource, SearchFilters } from "./search.js";
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
