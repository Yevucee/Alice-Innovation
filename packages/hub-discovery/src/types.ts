import type { CatalogueCapability, HubSubtype } from "@alice/database";

export interface DiscoveredHub {
  name: string;
  country?: string | null;
  city?: string | null;
  hubSubtype?: HubSubtype;
  website?: string | null;
  description?: string;
  externalId: string;
  directoryProfileUrl?: string | null;
  networks?: Array<{ networkSlug: string; memberRef?: string }>;
  raw?: Record<string, unknown>;
  /** Known ingestion catalogue URL if already verified */
  collectionUrl?: string | null;
  catalogueCapability?: CatalogueCapability;
  linkedSourceSlug?: string | null;
}

export interface HubDirectoryAdapter {
  slug: string;
  discover(ctx: DiscoveryContext): Promise<DiscoveredHub[]>;
}

export interface DiscoveryContext {
  userAgent: string;
  fetchText: (url: string) => Promise<{ status: number; body: string; finalUrl: string }>;
  limit?: number | null;
}
