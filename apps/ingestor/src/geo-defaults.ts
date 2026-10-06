import type { NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import {
  AFRICA_SOURCE_GEO_DEFAULTS,
  ASIA_SOURCE_GEO_DEFAULTS,
  continentForCountryCode,
  countryCodeFor,
} from "@alice/taxonomy";

export function applyGeographyDefaults(draft: NormalisedDraft, source: SourceRecord): NormalisedDraft {
  if (draft.countryName || draft.continentName) {
    return draft;
  }

  const africaDefaults = AFRICA_SOURCE_GEO_DEFAULTS[source.id];
  if (africaDefaults) {
    const countryName = africaDefaults.countryName ?? null;
    const countryCode = countryName ? countryCodeFor(countryName) : null;
    return {
      ...draft,
      countryName,
      countryCode,
      continentName: africaDefaults.continentName,
    };
  }

  const asiaDefaults = ASIA_SOURCE_GEO_DEFAULTS[source.id];
  if (asiaDefaults) {
    const countryName = asiaDefaults.countryName ?? null;
    const countryCode = countryName ? countryCodeFor(countryName) : null;
    return {
      ...draft,
      countryName,
      countryCode,
      continentName: asiaDefaults.continentName,
    };
  }

  if (source.category === "africa-innovation") {
    return { ...draft, continentName: "Africa" };
  }

  if (source.category === "asia-innovation") {
    return { ...draft, continentName: "Asia" };
  }

  return draft;
}

export function continentForDraft(draft: NormalisedDraft): string | null {
  if (draft.continentName) return draft.continentName;
  return continentForCountryCode(draft.countryCode);
}
