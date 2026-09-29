import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { HubSubtype } from "@alice/database";
import type { DiscoveredHub, HubDirectoryAdapter } from "../types.js";

interface SeedRow {
  name: string;
  country?: string;
  city?: string;
  hub_subtype?: string;
  website?: string;
  networks?: Array<{ network_slug: string }>;
  linked_portfolio_source?: string;
  portfolio_relationship?: string;
}

export function loadSeedOrganisations(configPath = resolve(process.cwd(), "config/hub-seed-organisations.yaml")): SeedRow[] {
  const doc = parse(readFileSync(configPath, "utf8")) as { organisations?: SeedRow[] };
  return doc.organisations ?? [];
}

export const seedOrganisationsDirectory: HubDirectoryAdapter = {
  slug: "seed-organisations",
  async discover(): Promise<DiscoveredHub[]> {
    return loadSeedOrganisations().map((row) => ({
      name: row.name,
      country: row.country ?? null,
      city: row.city ?? null,
      hubSubtype: (row.hub_subtype as HubSubtype) ?? "INNOVATION_HUB",
      website: row.website ?? null,
      externalId: `seed:${row.name}`,
      networks: (row.networks ?? []).map((n) => ({ networkSlug: n.network_slug })),
      raw: {
        linked_portfolio_source: row.linked_portfolio_source ?? null,
        portfolio_relationship: row.portfolio_relationship ?? null,
      },
      linkedSourceSlug: row.linked_portfolio_source ?? null,
      catalogueCapability: row.linked_portfolio_source ? "PORTFOLIO" : undefined,
      collectionUrl: null,
    }));
  },
};
