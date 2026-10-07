import { buildDraft } from "../draft.js";
import type { AdapterContext, DiscoveredRef, FetchedPage, SourceAdapter } from "../types.js";
import type { NormalisedDraft } from "@alice/shared";
import { listingPageFromJson, postJson } from "./http-json.js";

const USA_SPENDING_SEARCH = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

interface UsaAward {
  "Award ID"?: string;
  "Recipient Name"?: string;
  Description?: string;
  "generated_internal_id"?: string;
}

interface UsaSearchResponse {
  results?: UsaAward[];
  page_metadata?: { hasNext?: boolean };
}

function parseAward(page: FetchedPage): NormalisedDraft {
  let hit: UsaAward;
  try {
    hit = JSON.parse(page.html) as UsaAward;
  } catch {
    throw new Error(`USAspending record is not JSON: ${page.url}`);
  }
  const recipient = hit["Recipient Name"]?.replace(/\s+/g, " ").trim();
  const description = hit.Description?.replace(/\s+/g, " ").trim();
  const awardId = hit["Award ID"]?.trim();
  if (!awardId) throw new Error(`USAspending award has no id: ${page.url}`);
  const title = description && recipient ? `${recipient}: ${description}`.slice(0, 240) : recipient || description || awardId;
  const summary = description || title;
  const url = `https://www.usaspending.gov/award/${hit["generated_internal_id"] ?? awardId}`;
  return buildDraft({
    title,
    url,
    externalId: awardId,
    summary: summary.slice(0, 500),
    text: summary,
    resourceType: "RESEARCH",
    organisationName: recipient || null,
    evidenceBasis: "INDEPENDENT_ASSESSMENT",
    evidenceStage: "UNKNOWN",
    rawMetadata: { usaspending_sttr: true },
    etag: page.etag,
    lastModified: page.lastModified,
  });
}

function createKeywordAdapter(id: string, keyword: string, metadataKey: string): SourceAdapter {
  return {
    id,
    fullCatalogue: true,
    skipRobotsGuard: true,
    async discover(ctx: AdapterContext): Promise<DiscoveredRef[]> {
      const refs: DiscoveredRef[] = [];
      const pageSize = 100;
      const maxPagesDefault = 50;
      const maxRefs = ctx.limit ?? maxPagesDefault * pageSize;
      const maxPages = maxPagesDefault;
      const timeoutMs = Math.max(ctx.timeoutMs, 60_000);

      for (let page = 1; page <= maxPages; page += 1) {
        const payload = await postJson<UsaSearchResponse>(
          USA_SPENDING_SEARCH,
          {
            filters: {
              keywords: [keyword],
              award_type_codes: ["A", "B", "C", "D"],
            },
            fields: ["Award ID", "Recipient Name", "Description", "generated_internal_id"],
            page,
            limit: pageSize,
            sort: "Award ID",
            order: "asc",
          },
          { userAgent: ctx.userAgent, timeoutMs },
        );
        const awards = payload.results ?? [];
        if (awards.length === 0) break;
        for (const award of awards) {
          if (!award["Award ID"]) continue;
          const publicUrl = `https://www.usaspending.gov/award/${award["generated_internal_id"] ?? award["Award ID"]}`;
          refs.push({
            url: publicUrl,
            externalId: award["Award ID"],
            listingHtml: JSON.stringify({ ...award, [metadataKey]: true }),
          });
          if (refs.length >= maxRefs) break;
        }
        if (refs.length >= maxRefs) break;
        if (!payload.page_metadata?.hasNext) break;
      }
      return refs;
    },
    async fetch(ref: DiscoveredRef): Promise<FetchedPage> {
      return listingPageFromJson(ref, ref.listingHtml ? JSON.parse(ref.listingHtml) : {});
    },
    parse: parseAward,
  };
}

export const usaspendingSttrAdapter = createKeywordAdapter("usaspending-sttr-awards", "STTR", "usaspending_sttr");
