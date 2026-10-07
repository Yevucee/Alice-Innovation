import { InlineEnglishCardSummary } from "./inline-english-translation";

export function ResourceCardSummaryBlock({
  resourceId,
  title,
  summary,
  language,
  translateEnabled,
  sourcePageUrl,
}: {
  resourceId: string;
  title: string;
  summary: string;
  language?: string | null;
  translateEnabled: boolean;
  sourcePageUrl?: string | null;
}) {
  return (
    <InlineEnglishCardSummary
      resourceId={resourceId}
      title={title}
      summary={summary}
      language={language}
      translateEnabled={translateEnabled}
      sourcePageUrl={sourcePageUrl}
    />
  );
}
