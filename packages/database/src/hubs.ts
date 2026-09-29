import { canonicaliseUrl } from "@alice/shared";
import type { Queryable } from "./pool.js";
import { organisationSlug } from "./seed.js";

export type HubSubtype =
  | "INNOVATION_HUB"
  | "INCUBATOR"
  | "ACCELERATOR"
  | "MAKERSPACE"
  | "FABLAB"
  | "UNIVERSITY_INNOVATION_CENTRE"
  | "ECOSYSTEM_ORGANISATION"
  | "OTHER";

export type CatalogueCapability =
  | "UNKNOWN"
  | "NONE"
  | "PORTFOLIO"
  | "STARTUP_DIRECTORY"
  | "PROGRAMME_COHORT"
  | "CHALLENGE_SHOWCASE"
  | "CASE_STUDIES"
  | "MIXED";

export interface HubUpsertInput {
  name: string;
  country?: string | null;
  city?: string | null;
  hubSubtype?: HubSubtype | null;
  website?: string | null;
  description?: string;
  organisationType?: string;
  networks?: Array<{ networkSlug: string; memberRef?: string }>;
  metadata?: Record<string, unknown>;
}

export function websiteHost(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(canonicaliseUrl(url.trim())).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function mapOrganisationType(subtype: HubSubtype | null | undefined): string {
  switch (subtype) {
    case "INCUBATOR":
      return "INCUBATOR";
    case "ACCELERATOR":
      return "ACCELERATOR";
    case "MAKERSPACE":
      return "MAKERSPACE";
    case "FABLAB":
      return "FABLAB";
    case "UNIVERSITY_INNOVATION_CENTRE":
      return "UNIVERSITY";
    case "ECOSYSTEM_ORGANISATION":
      return "ECOSYSTEM_ORGANISATION";
    default:
      return "INNOVATION_HUB";
  }
}

export async function upsertInnovationHub(db: Queryable, input: HubUpsertInput): Promise<string> {
  const host = websiteHost(input.website);
  const subtype = input.hubSubtype ?? "INNOVATION_HUB";
  const orgType = input.organisationType ?? mapOrganisationType(subtype);
  const slug = organisationSlug(input.name.trim());
  const metadata = JSON.stringify(input.metadata ?? {});

  if (host) {
    const existing = await db.query<{ id: string }>(
      `SELECT id::text FROM organisations WHERE website_host = $1 LIMIT 1`,
      [host],
    );
    if (existing.rows[0]) {
      await db.query(
        `UPDATE organisations SET
           name = CASE WHEN length($2) > length(name) THEN $2 ELSE name END,
           country = COALESCE($3, country),
           city = COALESCE($4, city),
           hub_subtype = COALESCE($5, hub_subtype),
           organisation_type = $6,
           is_innovation_hub = true,
           website = COALESCE($7, website),
           description = CASE WHEN $8 <> '' THEN $8 ELSE description END,
           hub_metadata = hub_metadata || $9::jsonb,
           updated_at = now()
         WHERE id = $1`,
        [
          existing.rows[0].id,
          input.name.trim(),
          input.country ?? null,
          input.city ?? null,
          subtype,
          orgType,
          input.website ? canonicaliseUrl(input.website) : null,
          input.description ?? "",
          metadata,
        ],
      );
      await syncNetworks(db, existing.rows[0].id, input.networks ?? []);
      return existing.rows[0].id;
    }
  }

  const row = await db.query<{ id: string }>(
    `INSERT INTO organisations (
       name, slug, description, organisation_type, country, city, website, website_host,
       hub_subtype, is_innovation_hub, hub_metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10::jsonb)
     ON CONFLICT (slug) DO UPDATE SET
       country = COALESCE(EXCLUDED.country, organisations.country),
       city = COALESCE(EXCLUDED.city, organisations.city),
       hub_subtype = COALESCE(EXCLUDED.hub_subtype, organisations.hub_subtype),
       organisation_type = EXCLUDED.organisation_type,
       is_innovation_hub = true,
       website = COALESCE(EXCLUDED.website, organisations.website),
       website_host = COALESCE(EXCLUDED.website_host, organisations.website_host),
       description = CASE WHEN EXCLUDED.description <> '' THEN EXCLUDED.description ELSE organisations.description END,
       hub_metadata = organisations.hub_metadata || EXCLUDED.hub_metadata,
       updated_at = now()
     RETURNING id::text`,
    [
      input.name.trim(),
      slug,
      input.description ?? "",
      orgType,
      input.country ?? null,
      input.city ?? null,
      input.website ? canonicaliseUrl(input.website) : null,
      host,
      subtype,
      metadata,
    ],
  );
  const organisationId = row.rows[0].id;
  await syncNetworks(db, organisationId, input.networks ?? []);
  return organisationId;
}

async function syncNetworks(
  db: Queryable,
  organisationId: string,
  networks: Array<{ networkSlug: string; memberRef?: string }>,
): Promise<void> {
  for (const network of networks) {
    await db.query(
      `INSERT INTO organisation_network_memberships (organisation_id, network_slug, member_ref)
       VALUES ($1, $2, $3)
       ON CONFLICT (organisation_id, network_slug) DO UPDATE SET member_ref = EXCLUDED.member_ref`,
      [organisationId, network.networkSlug, network.memberRef ?? ""],
    );
  }
}

export async function recordHubDirectoryDiscovery(
  db: Queryable,
  input: {
    directorySlug: string;
    organisationId: string;
    externalId: string;
    directoryProfileUrl?: string | null;
    rawSnapshot?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO hub_directory_discoveries (
       directory_slug, organisation_id, external_id, directory_profile_url, raw_snapshot
     ) VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (directory_slug, organisation_id) DO UPDATE SET
       external_id = EXCLUDED.external_id,
       directory_profile_url = COALESCE(EXCLUDED.directory_profile_url, hub_directory_discoveries.directory_profile_url),
       raw_snapshot = hub_directory_discoveries.raw_snapshot || EXCLUDED.raw_snapshot,
       discovered_at = now()`,
    [
      input.directorySlug,
      input.organisationId,
      input.externalId,
      input.directoryProfileUrl ?? null,
      JSON.stringify(input.rawSnapshot ?? {}),
    ],
  );
}

export async function upsertSourceCandidate(
  db: Queryable,
  input: {
    organisationId: string;
    proposedSlug: string;
    homepage?: string | null;
    collectionUrl?: string | null;
    catalogueCapability: CatalogueCapability;
    verificationNotes?: string;
    accessStatus?: string;
    robotsAllowed?: boolean | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO innovation_source_candidates (
       organisation_id, proposed_slug, homepage, collection_url, catalogue_capability,
       verification_notes, access_status, robots_allowed, robots_checked_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::boolean,
       CASE WHEN $8::boolean IS NOT NULL THEN now() ELSE NULL END, now())
     ON CONFLICT (proposed_slug) DO UPDATE SET
       homepage = COALESCE(EXCLUDED.homepage, innovation_source_candidates.homepage),
       collection_url = COALESCE(EXCLUDED.collection_url, innovation_source_candidates.collection_url),
       catalogue_capability = EXCLUDED.catalogue_capability,
       verification_notes = EXCLUDED.verification_notes,
       access_status = EXCLUDED.access_status,
       robots_allowed = COALESCE(EXCLUDED.robots_allowed, innovation_source_candidates.robots_allowed),
       robots_checked_at = COALESCE(innovation_source_candidates.robots_checked_at,
         CASE WHEN EXCLUDED.robots_allowed IS NOT NULL THEN now() ELSE NULL END),
       updated_at = now()`,
    [
      input.organisationId,
      input.proposedSlug,
      input.homepage ? canonicaliseUrl(input.homepage) : null,
      input.collectionUrl ? canonicaliseUrl(input.collectionUrl) : null,
      input.catalogueCapability,
      input.verificationNotes ?? "",
      input.accessStatus ?? "UNVERIFIED",
      input.robotsAllowed ?? null,
    ],
  );
}

export async function hubDiscoveryStats(db: Queryable): Promise<Record<string, number>> {
  const row = await db.query<{
    hubs: string;
    discoveries: string;
    candidates: string;
    afrilabs: string;
    fablabs: string;
  }>(
    `SELECT
       (SELECT count(*) FROM organisations WHERE is_innovation_hub) AS hubs,
       (SELECT count(*) FROM hub_directory_discoveries) AS discoveries,
       (SELECT count(*) FROM innovation_source_candidates) AS candidates,
       (SELECT count(*) FROM hub_directory_discoveries WHERE directory_slug = 'afrilabs') AS afrilabs,
       (SELECT count(*) FROM hub_directory_discoveries WHERE directory_slug = 'fablabs-io') AS fablabs`,
  );
  const stats = row.rows[0];
  return {
    innovation_hubs: Number(stats?.hubs ?? 0),
    directory_discoveries: Number(stats?.discoveries ?? 0),
    source_candidates: Number(stats?.candidates ?? 0),
    afrilabs_discoveries: Number(stats?.afrilabs ?? 0),
    fablabs_discoveries: Number(stats?.fablabs ?? 0),
  };
}
