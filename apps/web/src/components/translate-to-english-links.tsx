"use client";

import { likelyNeedsTranslation } from "@/lib/needs-translation";
import { googleTranslatePageUrl, googleTranslateTextUrl } from "@/lib/google-translate";

function stopNav(event: React.MouseEvent) {
  event.stopPropagation();
}

export function TranslateToEnglishLinks({
  title,
  summary,
  language,
  sourcePageUrl,
  compact = false,
}: {
  title: string;
  summary: string;
  language?: string | null;
  sourcePageUrl?: string | null;
  /** Smaller styling for resource cards */
  compact?: boolean;
}) {
  const sample = `${title}\n\n${summary}`;
  if (!likelyNeedsTranslation(sample, language ?? null)) return null;

  const textUrl = googleTranslateTextUrl(sample);
  const pageUrl = sourcePageUrl?.trim() ? googleTranslatePageUrl(sourcePageUrl.trim()) : null;
  const className = compact
    ? "mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium"
    : "mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium";

  return (
    <div className={className} onClick={stopNav} onKeyDown={(e) => e.stopPropagation()} role="presentation">
      <a
        href={textUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-accent hover:underline"
        onClick={stopNav}
      >
        Translate to English ↗
      </a>
      {pageUrl ? (
        <a
          href={pageUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted hover:text-ink hover:underline"
          onClick={stopNav}
        >
          Translate source page ↗
        </a>
      ) : null}
      {!compact ? (
        <span className="text-muted font-normal">Opens Google Translate (works on phone &amp; desktop).</span>
      ) : null}
    </div>
  );
}
