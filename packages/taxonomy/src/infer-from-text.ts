export interface TaxonomyInference {
  sectors: string[];
  problems: string[];
  technologies: string[];
}

interface KeywordRule {
  slug: string;
  /** Phrases matched with word boundaries (case-insensitive). */
  phrases: string[];
}

const SECTOR_RULES: KeywordRule[] = [
  { slug: "agriculture", phrases: ["agriculture", "agri-tech", "agritech", "farming", "smallholder", "crop", "livestock", "soil"] },
  {
    slug: "water",
    phrases: [
      "drinking water",
      "clean water",
      "potable water",
      "water access",
      "sanitation",
      "hygiene",
      "desalination",
      "groundwater",
      "rainwater",
      "water scarcity",
      "water supply",
      "water filter",
    ],
  },
  { slug: "energy", phrases: ["energy", "solar", "wind power", "off-grid", "electrification", "battery", "biogas"] },
  { slug: "food", phrases: ["food security", "nutrition", "food system", "food tech"] },
  { slug: "climate", phrases: ["climate", "carbon", "emissions", "decarbon", "net zero", "greenhouse"] },
  { slug: "health", phrases: ["health", "healthcare", "medical", "maternal", "diagnostic", "pharma"] },
  { slug: "education", phrases: ["education", "edtech", "learning", "school", "literacy", "training"] },
  { slug: "waste", phrases: ["waste", "recycling", "landfill", "compost", "circular economy", "plastic waste", "e-waste", "waste management", "solid waste"] },
  { slug: "biodiversity", phrases: ["biodiversity", "conservation", "wildlife", "ecosystem", "reforestation"] },
  { slug: "finance", phrases: ["fintech", "financial inclusion", "microfinance", "insurance", "lending"] },
  { slug: "government", phrases: ["government", "public sector", "policy", "civic tech"] },
  { slug: "community-development", phrases: ["community development", "livelihood", "social enterprise"] },
];

const PROBLEM_RULES: KeywordRule[] = [
  { slug: "drinking-water", phrases: ["drinking water", "clean water", "potable water", "water access"] },
  { slug: "wastewater", phrases: ["wastewater", "sewage", "effluent"] },
  { slug: "irrigation", phrases: ["irrigation", "drip irrigation"] },
  { slug: "food-loss", phrases: ["food loss", "food waste", "spoilage", "post-harvest"] },
  { slug: "energy-access", phrases: ["energy access", "electricity access", "off-grid", "unreliable grid"] },
  { slug: "cold-chain", phrases: ["cold chain", "cold storage", "refrigeration"] },
  { slug: "flooding", phrases: ["flooding", "flood risk", "stormwater"] },
  { slug: "waste-management", phrases: ["waste management", "solid waste", "landfill", "recycling", "circular economy", "plastic pollution", "e-waste"] },
  { slug: "healthcare-access", phrases: ["healthcare access", "primary care", "health access"] },
  { slug: "education-access", phrases: ["education access", "out of school", "learning poverty"] },
  { slug: "financial-inclusion", phrases: ["financial inclusion", "unbanked", "underbanked"] },
  { slug: "biodiversity-loss", phrases: ["biodiversity loss", "habitat loss", "deforestation"] },
];

const TECHNOLOGY_RULES: KeywordRule[] = [
  { slug: "solar", phrases: ["solar", "photovoltaic", "pv panel"] },
  { slug: "drip-irrigation", phrases: ["drip irrigation", "micro-irrigation"] },
  { slug: "filtration", phrases: ["filtration", "water filter", "membrane"] },
  { slug: "recycling", phrases: ["recycling", "upcycling"] },
  { slug: "sensors", phrases: ["sensor", "iot", "telemetry"] },
  { slug: "mobile-technology", phrases: ["mobile app", "ussd", "sms"] },
  { slug: "evaporative-cooling", phrases: ["evaporative cooling", "cooling chamber"] },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPhrase(haystack: string, phrase: string): boolean {
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(phrase)}(?:[^a-z0-9]|$)`, "i");
  return pattern.test(` ${haystack} `);
}

function matchRules(haystack: string, rules: KeywordRule[], max: number): string[] {
  const hits: string[] = [];
  for (const rule of rules) {
    if (hits.length >= max) break;
    if (rule.phrases.some((phrase) => matchesPhrase(haystack, phrase))) {
      hits.push(rule.slug);
    }
  }
  return hits;
}

/** Conservative keyword tagging from title, summary, body, and adapter tags. */
export function inferTaxonomyFromText(input: {
  title?: string;
  summary?: string;
  text?: string;
  tags?: string[];
}): TaxonomyInference {
  const haystack = [input.title, input.summary, input.text, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) {
    return { sectors: [], problems: [], technologies: [] };
  }

  return {
    sectors: matchRules(haystack, SECTOR_RULES, 3),
    problems: matchRules(haystack, PROBLEM_RULES, 3),
    technologies: matchRules(haystack, TECHNOLOGY_RULES, 3),
  };
}
