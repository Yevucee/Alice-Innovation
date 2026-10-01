import {
  correctMisassignedWaterSectorTags,
  invalidateStaleEnrichmentEmbeddings,
  loadResourceIdsNeedingReembed,
  mergeDuplicateOrganisations,
  repairLegalFormOrganisationLinks,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";

export async function runPostIngestCatalogueRepairs(db: Queryable): Promise<void> {
  try {
    const orgMerge = await mergeDuplicateOrganisations(db);
    const legal = await repairLegalFormOrganisationLinks(db);
    const water = await correctMisassignedWaterSectorTags(db);
    log("info", "post_ingest_catalogue_repairs", {
      org_merge_groups: orgMerge.groups,
      org_merge_removed: orgMerge.removed,
      legal_form_orgs_removed: legal.orgs_removed,
      people_org_cleared: legal.people_cleared,
      water_sector_tags_removed: water,
    });
  } catch (error) {
    log("warn", "post_ingest_catalogue_repairs_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function resolvePriorityReembedResourceIds(
  db: Queryable,
  enrichedResourceIds: string[],
): Promise<string[]> {
  const invalidated = await invalidateStaleEnrichmentEmbeddings(db);
  const staleIds = await loadResourceIdsNeedingReembed(db);
  const merged = [...new Set([...enrichedResourceIds, ...staleIds])];
  log("info", "post_ingest_reembed_queue", {
    enriched_this_run: enrichedResourceIds.length,
    embedding_hashes_invalidated: invalidated,
    stale_ids: staleIds.length,
    priority_total: merged.length,
  });
  return merged;
}
