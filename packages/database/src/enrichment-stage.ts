import type { EvidenceStage } from "@alice/shared";

const STAGE_ALIASES: Record<string, EvidenceStage> = {
  IDEA: "IDEA",
  CONCEPT: "IDEA",
  EARLY: "IDEA",
  SEED: "IDEA",
  PRE_SEED: "IDEA",
  PROTOTYPE: "PROTOTYPE",
  MVP: "PROTOTYPE",
  PILOT: "PILOT",
  PILOTING: "PILOT",
  TRIAL: "PILOT",
  DEPLOYED: "DEPLOYED",
  DEPLOYMENT: "DEPLOYED",
  COMMERCIAL: "DEPLOYED",
  MARKET: "DEPLOYED",
  MULTIPLE_DEPLOYMENTS: "MULTIPLE_DEPLOYMENTS",
  SCALED: "SCALED",
  SCALE: "SCALED",
  GROWTH: "SCALED",
  UNKNOWN: "UNKNOWN",
};

export function normaliseEnrichmentStageLabel(raw: string | null | undefined): EvidenceStage | null {
  if (!raw?.trim()) return null;
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return STAGE_ALIASES[key] ?? null;
}

/** Map adapter/source metadata fields to evidence stage before LLM. */
export function stageFromAdapterMetadata(
  sourceSlug: string | null,
  metadata: Record<string, unknown> | null | undefined,
): EvidenceStage | null {
  if (!metadata || typeof metadata !== "object") return null;
  const direct = metadata.stage ?? metadata.evidence_stage ?? metadata.maturity_stage ?? metadata.trl;
  if (typeof direct === "string") {
    const fromDirect = normaliseEnrichmentStageLabel(direct);
    if (fromDirect && fromDirect !== "UNKNOWN") return fromDirect;
    const fromPhrase = inferStageFromText(direct);
    if (fromPhrase) return fromPhrase;
  }
  if (typeof direct === "number" && direct >= 1 && direct <= 3) return "IDEA";
  if (typeof direct === "number" && direct >= 4 && direct <= 6) return "PROTOTYPE";
  if (typeof direct === "number" && direct >= 7 && direct <= 8) return "PILOT";
  if (typeof direct === "number" && direct >= 9) return "DEPLOYED";

  const solveStage = metadata.solve_stage ?? metadata.programme_stage;
  if (typeof solveStage === "string") {
    const mapped = normaliseEnrichmentStageLabel(solveStage);
    if (mapped && mapped !== "UNKNOWN") return mapped;
  }

  if (sourceSlug === "mit-solve" && typeof metadata.headquarters === "string") {
    /* headquarters alone is not stage */
  }

  const vc4a = metadata.investment_stage ?? metadata.company_stage;
  if (typeof vc4a === "string") {
    const lower = vc4a.toLowerCase();
    if (/seed|pre-seed|idea/.test(lower)) return "IDEA";
    if (/prototype|mvp|beta/.test(lower)) return "PROTOTYPE";
    if (/pilot|trial/.test(lower)) return "PILOT";
    if (/revenue|commercial|deploy|market|growth|scale/.test(lower)) return "DEPLOYED";
  }

  return null;
}

const STAGE_SIGNALS: Array<{ pattern: RegExp; stage: EvidenceStage }> = [
  { pattern: /\b(pilot(?:ing)?|trial(?:s)?|proof of concept)\b/i, stage: "PILOT" },
  { pattern: /\b(prototype|mvp|beta version)\b/i, stage: "PROTOTYPE" },
  { pattern: /\b(deployed|commerciali[sz]ed|on the market|paying customers?)\b/i, stage: "DEPLOYED" },
  { pattern: /\b(scaled|scaling|(?:in|across) \d+\+?\s*countries|nationwide rollout)\b/i, stage: "SCALED" },
  { pattern: /\b(early.?stage|concept|idea stage|pre.?seed)\b/i, stage: "IDEA" },
  { pattern: /\b(award|grant|funding round|series [abc])\b/i, stage: "PILOT" },
];

export function inferStageFromText(text: string): EvidenceStage | null {
  if (!text?.trim()) return null;
  for (const { pattern, stage } of STAGE_SIGNALS) {
    if (pattern.test(text)) return stage;
  }
  return null;
}
