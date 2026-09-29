import type { Queryable } from "@alice/database";
import { upsertSourceCandidate } from "@alice/database";
import { checkRobotsForUrl } from "./access-check.js";
import { probeCatalogueCapability } from "./catalogue-probe.js";
import type { DiscoveryContext } from "./types.js";

export async function reprobeSourceCandidates(
  db: Queryable,
  ctx: DiscoveryContext,
  limit = 200,
): Promise<{ probed: number; robotsOk: number }> {
  const rows = await db.query<{
    organisation_id: string;
    proposed_slug: string;
    homepage: string;
  }>(
    `SELECT c.organisation_id::text, c.proposed_slug, c.homepage
     FROM innovation_source_candidates c
     JOIN organisations o ON o.id = c.organisation_id
     WHERE c.homepage IS NOT NULL
       AND o.website_host IS NOT NULL
       AND o.website_host NOT IN ('afrilabs.com', 'www.afrilabs.com')
     ORDER BY c.updated_at ASC
     LIMIT $1`,
    [limit],
  );
  let robotsOk = 0;
  for (const row of rows.rows) {
    const probe = await probeCatalogueCapability(ctx, row.homepage);
    const robots = await checkRobotsForUrl(ctx, row.homepage);
    if (robots.allowed) robotsOk += 1;
    await upsertSourceCandidate(db, {
      organisationId: row.organisation_id,
      proposedSlug: row.proposed_slug,
      homepage: row.homepage,
      collectionUrl: probe.collectionUrl,
      catalogueCapability: probe.capability,
      verificationNotes: `${probe.notes};${robots.notes}`,
      accessStatus: robots.allowed ? "ROBOTS_OK" : "ROBOTS_BLOCKED",
      robotsAllowed: robots.allowed,
    });
  }
  return { probed: rows.rows.length, robotsOk };
}
