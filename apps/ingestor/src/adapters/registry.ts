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
  ...remainingCatalogueAdapters,
];

const ADAPTERS: SourceAdapter[] = [
  ...CORE_ADAPTERS,
  ...buildPlaceholderAdapters(new Set(CORE_ADAPTERS.map((adapter) => adapter.id))),
];

export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}

export function listAdapters(): string[] {
  return ADAPTERS.map((adapter) => adapter.id);
}
