import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { HubSubtype } from "@alice/database";
import type { DiscoveredHub, HubDirectoryAdapter } from "../types.js";

interface YamlOrg {
  name: string;
  country?: string;
  city?: string;
  hub_subtype?: string;
  website?: string;
}

export function createYamlDirectoryAdapter(
  slug: string,
  configFile: string,
  networkSlug: string,
): HubDirectoryAdapter {
  return {
    slug,
    async discover(): Promise<DiscoveredHub[]> {
      const path = resolve(process.cwd(), configFile);
      const doc = parse(readFileSync(path, "utf8")) as { organisations?: YamlOrg[] };
      return (doc.organisations ?? []).map((row) => ({
        name: row.name,
        country: row.country ?? null,
        city: row.city ?? null,
        hubSubtype: (row.hub_subtype as HubSubtype) ?? "INNOVATION_HUB",
        website: row.website ?? null,
        externalId: `${slug}:${row.name}`,
        networks: [{ networkSlug }],
        raw: { source_file: configFile },
      }));
    },
  };
}
