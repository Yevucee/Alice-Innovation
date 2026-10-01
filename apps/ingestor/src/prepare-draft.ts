import type { NormalisedDraft } from "@alice/shared";
import type { SourceRecord } from "@alice/source-registry";
import { continentForCountryCode, inferCountryFromText } from "@alice/taxonomy";
import { applyGeographyDefaults } from "./geo-defaults.js";

/** Geography defaults, then conservative country inference from title/body text. */
export function prepareIngestDraft(draft: NormalisedDraft, source: SourceRecord): NormalisedDraft {
  let prepared = applyGeographyDefaults(draft, source);
  if (prepared.countryName) return prepared;

  const haystack = [prepared.title, prepared.sourceSummary, prepared.extractedText].filter(Boolean).join("\n");
  const inferred = inferCountryFromText(haystack);
  if (!inferred.countryName) return prepared;

  return {
    ...prepared,
    countryName: inferred.countryName,
    countryCode: inferred.countryCode,
    continentName: prepared.continentName ?? continentForCountryCode(inferred.countryCode),
  };
}
