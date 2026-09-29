import type { NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import { AFRICA_SOURCE_GEO_DEFAULTS, continentForCountryCode, countryCodeFor } from "@alice/taxonomy";

export function applyGeographyDefaults(draft: NormalisedDraft, source: SourceRecord): NormalisedDraft {
  if (draft.countryName || draft.continentName) {
    return draft;
  }

  const defaults = AFRICA_SOURCE_GEO_DEFAULTS[source.id];
  if (defaults) {
    const countryName = defaults.countryName ?? null;
    const countryCode = countryName ? countryCodeFor(countryName) : null;
    return {
      ...draft,
      countryName,
      countryCode,
      continentName: defaults.continentName,
    };
  }

  if (source.category === "africa-innovation") {
    return { ...draft, continentName: "Africa" };
  }

  return draft;
}

export function continentForDraft(draft: NormalisedDraft): string | null {
  if (draft.continentName) return draft.continentName;
  return continentForCountryCode(draft.countryCode);
}
