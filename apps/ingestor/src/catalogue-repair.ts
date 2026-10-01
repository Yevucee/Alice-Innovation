import {
  correctMisassignedWaterSectorTags,
  invalidateStaleEnrichmentEmbeddings,
  loadResourceIdsNeedingReembed,
  mergeDuplicateOrganisations,
  repairLegalFormOrganisationLinks,
  repairMarkdownHashTitles,
} from "@alice/database";
import type { Queryable } from "@alice/database";
import { log } from "@alice/shared";

export async function runPostIngestCatalogueRepairs(db: Queryable): Promise<{
  org_merge_groups: number;
  org_merge_removed: number;
  legal_form_orgs_removed: number;
  people_org_cleared: number;
  markdown_titles_repaired: number;
  water_sector_tags_removed: number;
}> {
  const orgMerge = await mergeDuplicateOrganisations(db);
  const legal = await repairLegalFormOrganisationLinks(db);
  const markdownTitles = await repairMarkdownHashTitles(db);
  const water = await correctMisassignedWaterSectorTags(db);
  const summary = {
    org_merge_groups: orgMerge.groups,
    org_merge_removed: orgMerge.removed,
    legal_form_orgs_removed: legal.orgs_removed,
    people_org_cleared: legal.people_cleared,
    markdown_titles_repaired: markdownTitles,
    water_sector_tags_removed: water,
  };
  log("info", "post_ingest_catalogue_repairs", summary);
  return summary;
}

export async function resolvePriorityReembedResourceIds(
  db: Queryable,
  enrichedResourceIds: string[],
): Promise<{ ids: string[]; enriched_this_run: number; embedding_hashes_invalidated: number; stale_ids: number }> {
  const invalidated = await invalidateStaleEnrichmentEmbeddings(db);
  const staleIds = await loadResourceIdsNeedingReembed(db);
  const merged = [...new Set([...enrichedResourceIds, ...staleIds])];
  log("info", "post_ingest_reembed_queue", {
    enriched_this_run: enrichedResourceIds.length,
    embedding_hashes_invalidated: invalidated,
    stale_ids: staleIds.length,
    priority_total: merged.length,
  });
  return {
    ids: merged,
    enriched_this_run: enrichedResourceIds.length,
    embedding_hashes_invalidated: invalidated,
    stale_ids: staleIds.length,
  };
}
