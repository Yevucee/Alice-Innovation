import {
  hubDiscoveryStats,
  recordHubDirectoryDiscovery,
  upsertInnovationHub,
  upsertSourceCandidate,
  type CatalogueCapability,
} from "@alice/database";
import { log } from "@alice/shared";
import type { Queryable } from "@alice/database";
import { checkRobotsForUrl } from "./access-check.js";
import { probeCatalogueCapability } from "./catalogue-probe.js";
import { afrilabsDirectory } from "./directories/afrilabs.js";
import { fablabsIoDirectory } from "./directories/fablabs-io.js";
import { seedOrganisationsDirectory } from "./directories/seed-organisations.js";
import { directoryStubs } from "./directories/stubs.js";
import { linkPortfolioResourcesToHub } from "./portfolio-links.js";
import type { DiscoveredHub, DiscoveryContext, HubDirectoryAdapter } from "./types.js";

const ADAPTERS: HubDirectoryAdapter[] = [
  seedOrganisationsDirectory,
  afrilabsDirectory,
  fablabsIoDirectory,
  ...directoryStubs,
];

function proposedSourceSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return base || "hub-candidate";
}

export interface RunHubDiscoveryOptions {
  directories?: string[];
  limitPerDirectory?: number | null;
  probeCatalogues?: boolean;
  checkRobots?: boolean;
  linkPortfolios?: boolean;
}

export async function runHubDiscovery(
  db: Queryable,
  ctx: DiscoveryContext,
  options: RunHubDiscoveryOptions = {},
): Promise<Record<string, number>> {
  const selected = new Set(options.directories ?? ADAPTERS.map((a) => a.slug));
  const counters = { organisations: 0, discoveries: 0, candidates: 0, links: 0 };

  for (const adapter of ADAPTERS) {
    if (!selected.has(adapter.slug)) continue;
    const adapterCtx: DiscoveryContext = {
      ...ctx,
      limit: options.limitPerDirectory ?? ctx.limit ?? null,
    };
    log("info", "hub_directory_start", { directory: adapter.slug });
    const hubs = await adapter.discover(adapterCtx);
    for (const hub of hubs) {
      const organisationId = await upsertInnovationHub(db, {
        name: hub.name,
        country: hub.country ?? null,
        city: hub.city ?? null,
        hubSubtype: hub.hubSubtype,
        website: hub.website ?? null,
        description: hub.description,
        networks: hub.networks,
        metadata: { directories: [adapter.slug] },
      });
      counters.organisations += 1;
      await recordHubDirectoryDiscovery(db, {
        directorySlug: adapter.slug,
        organisationId,
        externalId: hub.externalId,
        directoryProfileUrl: hub.directoryProfileUrl,
        rawSnapshot: hub.raw ?? {},
      });
      counters.discoveries += 1;

      const homepage = hub.website ?? hub.directoryProfileUrl ?? null;
      let capability: CatalogueCapability = hub.catalogueCapability ?? "UNKNOWN";
      let collectionUrl = hub.collectionUrl ?? null;
      let verificationNotes = "";
      let robotsAllowed: boolean | null = null;
      let accessStatus = "UNVERIFIED";

      if (hub.linkedSourceSlug) {
        capability = hub.catalogueCapability ?? "PORTFOLIO";
        accessStatus = "ACTIVE_SOURCE";
        verificationNotes = `linked_source:${hub.linkedSourceSlug}`;
      } else if (options.probeCatalogues && homepage) {
        const probe = await probeCatalogueCapability(ctx, homepage);
        capability = probe.capability;
        collectionUrl = probe.collectionUrl;
        verificationNotes = probe.notes;
      }

      if (options.checkRobots && homepage) {
        const robots = await checkRobotsForUrl(ctx, homepage);
        robotsAllowed = robots.allowed;
        accessStatus = robots.allowed ? "ROBOTS_OK" : "ROBOTS_BLOCKED";
        verificationNotes = `${verificationNotes};${robots.notes}`.replace(/^;/, "");
      }

      const shouldCandidate = capability !== "NONE" && capability !== "UNKNOWN" || hub.linkedSourceSlug;
      if (shouldCandidate && homepage) {
        await upsertSourceCandidate(db, {
          organisationId,
          proposedSlug: hub.linkedSourceSlug ?? proposedSourceSlug(hub.name),
          homepage,
          collectionUrl,
          catalogueCapability: capability,
          verificationNotes,
          accessStatus,
          robotsAllowed,
        });
        counters.candidates += 1;
      }

      if (options.linkPortfolios) {
        const sourceSlug = hub.linkedSourceSlug
          ?? (typeof hub.raw?.linked_portfolio_source === "string" ? hub.raw.linked_portfolio_source : null);
        const relationship = typeof hub.raw?.portfolio_relationship === "string"
          ? hub.raw.portfolio_relationship
          : "SHOWCASED_AT";
        if (sourceSlug) {
          counters.links += await linkPortfolioResourcesToHub(db, sourceSlug, organisationId, relationship);
        }
      }
    }
    log("info", "hub_directory_finished", { directory: adapter.slug, discovered: hubs.length });
  }

  const stats = await hubDiscoveryStats(db);
  return { ...counters, ...stats };
}
