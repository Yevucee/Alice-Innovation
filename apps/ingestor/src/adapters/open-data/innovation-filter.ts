const ADMIN_PATTERNS = [
  /\bwork programme\b/i,
  /\bgrant agreement\b/i,
  /\bproject management\b/i,
  /\bdissemination\b.*\bonly\b/i,
  /\badministrative\b/i,
];

const INNOVATION_SIGNALS = [
  /\binnovat/i,
  /\bstartup/i,
  /\bscale-?up/i,
  /\bsme\b/i,
  /\bcommercial/i,
  /\bmarket\b/i,
  /\bproduct\b/i,
  /\btechnology transfer\b/i,
  /\baccelerator\b/i,
  /\bventure\b/i,
  /\beic\b/i,
  /\bhorizon\b/i,
  /\bsbir\b/i,
  /\bsttr\b/i,
];

export function cordisHitLooksInnovationRelevant(input: {
  title?: string;
  teaser?: string;
  relatedProjectAcronym?: string;
}): boolean {
  const blob = [input.title, input.teaser, input.relatedProjectAcronym].filter(Boolean).join(" ");
  if (!blob.trim()) return false;
  if (ADMIN_PATTERNS.some((re) => re.test(blob))) return false;
  return INNOVATION_SIGNALS.some((re) => re.test(blob));
}

export function usaspendingAwardLooksSbirInnovation(description: string, recipient: string): boolean {
  const blob = `${recipient} ${description}`;
  if (!/\bSBIR\b/i.test(blob) && !/\bSTTR\b/i.test(blob)) return false;
  if (/\bIGF::OT::IGF\b/i.test(blob) && blob.length < 80) return false;
  return true;
}

export function nihProjectLooksSbirInnovation(title: string, abstract: string): boolean {
  const blob = `${title} ${abstract}`;
  return /\bSBIR\b/i.test(blob) || /\bSTTR\b/i.test(blob) || /\bsmall business innovation\b/i.test(blob);
}
