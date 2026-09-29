import { loadSeedOrganisations } from "./seed-organisations.js";
import type { DiscoveredHub, HubDirectoryAdapter } from "../types.js";

/** GHN has no public member API; seed orgs tagged ghana-hubs-network plus known names from public communications. */
export const ghanaHubsNetworkDirectory: HubDirectoryAdapter = {
  slug: "ghana-hubs-network",
  async discover(): Promise<DiscoveredHub[]> {
    const fromSeed = loadSeedOrganisations()
      .filter((row) => row.networks?.some((n) => n.network_slug === "ghana-hubs-network"))
      .map((row) => ({
        name: row.name,
        country: row.country ?? "Ghana",
        city: row.city ?? null,
        hubSubtype: (row.hub_subtype as DiscoveredHub["hubSubtype"]) ?? "INNOVATION_HUB",
        website: row.website ?? null,
        externalId: `ghn-seed:${row.name}`,
        networks: [{ networkSlug: "ghana-hubs-network" }],
      }));

    const supplements: DiscoveredHub[] = [
      {
        name: "Coral Reef Innovation Africa",
        country: "Ghana",
        city: "Accra",
        hubSubtype: "INNOVATION_HUB",
        externalId: "ghn:supplement:coral-reef",
        networks: [{ networkSlug: "ghana-hubs-network" }],
        raw: { note: "Named in GHN Tech in Ghana communications" },
      },
      {
        name: "Centre for Social Innovations",
        country: "Ghana",
        hubSubtype: "INNOVATION_HUB",
        externalId: "ghn:supplement:csi",
        networks: [{ networkSlug: "ghana-hubs-network" }],
      },
    ];

    return [...fromSeed, ...supplements];
  },
};
