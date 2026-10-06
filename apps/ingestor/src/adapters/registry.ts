import type { Queryable } from "@alice/database";
import { loadPromotedCatalogueConfigs } from "@alice/database";
import { createHtmlCatalogueAdapter } from "./html-catalogue.js";
import type { SourceAdapter } from "./types.js";
import { engineeringForChangeAdapter } from "./engineering-for-change.js";
import { mitSolveAdapter } from "./mit-solve.js";
import { projectDrawdownAdapter } from "./project-drawdown.js";
import { solarImpulseAdapter } from "./solar-impulse.js";
import { springwiseAdapter } from "./springwise.js";
import { xprizeAdapter } from "./xprize.js";
import { challengeWorksAdapter } from "./challenge-works.js";
import { wipoGreenAdapter } from "./wipo-green.js";
import { catalogueAdapters } from "./catalogue-adapters.js";
import { africaAdapters } from "./africa-adapters.js";
import { africaSecondPassAdapters } from "./africa-second-pass-adapters.js";
import { pausedCatalogueAdapters } from "./paused-catalogue-adapters.js";
import { buildPlaceholderAdapters, remainingCatalogueAdapters } from "./placeholder-adapters.js";
import { seedstarsAdapter } from "./seedstars.js";

const CORE_ADAPTERS: SourceAdapter[] = [
  solarImpulseAdapter,
  engineeringForChangeAdapter,
  mitSolveAdapter,
  springwiseAdapter,
  projectDrawdownAdapter,
  xprizeAdapter,
  challengeWorksAdapter,
  wipoGreenAdapter,
  seedstarsAdapter,
  ...catalogueAdapters,
  ...africaAdapters,
  ...africaSecondPassAdapters,
  ...pausedCatalogueAdapters,
  ...remainingCatalogueAdapters,
];

const adapterById = new Map<string, SourceAdapter>();
for (const adapter of CORE_ADAPTERS) {
  adapterById.set(adapter.id, adapter);
}
for (const adapter of buildPlaceholderAdapters(new Set(CORE_ADAPTERS.map((item) => item.id)))) {
  if (!adapterById.has(adapter.id)) adapterById.set(adapter.id, adapter);
}

export function registerPromotedCatalogueAdapter(adapter: SourceAdapter): void {
  adapterById.set(adapter.id, adapter);
}

export async function ensurePromotedCatalogueAdapters(db: Queryable): Promise<void> {
  const configs = await loadPromotedCatalogueConfigs(db);
  for (const row of configs) {
    registerPromotedCatalogueAdapter(
      createHtmlCatalogueAdapter({
        id: row.source_slug,
        siteOrigin: row.site_origin,
        pathPattern: new RegExp(row.path_pattern, "i"),
        resourceType: "SOLUTION",
        evidenceBasis: "PROGRAMME_SELECTED",
      }),
    );
  }
}

export function getAdapter(id: string): SourceAdapter | undefined {
  return adapterById.get(id);
}

export function listAdapters(): string[] {
  return [...adapterById.keys()];
}
