import type { SourceAdapter } from "./types.js";
import { engineeringForChangeAdapter } from "./engineering-for-change.js";
import { mitSolveAdapter } from "./mit-solve.js";
import { projectDrawdownAdapter } from "./project-drawdown.js";
import { solarImpulseAdapter } from "./solar-impulse.js";
import { springwiseAdapter } from "./springwise.js";

const ADAPTERS: SourceAdapter[] = [
  solarImpulseAdapter,
  engineeringForChangeAdapter,
  mitSolveAdapter,
  springwiseAdapter,
  projectDrawdownAdapter,
];

export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}

export function listAdapters(): string[] {
  return ADAPTERS.map((adapter) => adapter.id);
}
