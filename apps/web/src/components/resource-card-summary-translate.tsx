import { TranslateToEnglishLinks } from "./translate-to-english-links";

export function ResourceCardSummaryBlock({
  title,
  summary,
  sourcePageUrl,
}: {
  title: string;
  summary: string;
  sourcePageUrl?: string | null;
}) {
  return (
    <>
      <p className="line-clamp-3 min-h-[4.125rem] shrink-0 text-sm leading-relaxed text-muted">{summary}</p>
      <TranslateToEnglishLinks
        title={title}
        summary={summary}
        sourcePageUrl={sourcePageUrl}
        compact
      />
    </>
  );
}
