"use client";

import { useCallback, useState } from "react";
import { likelyNeedsTranslation } from "@/lib/needs-translation";

export function ResourceCardSummaryTranslate({
  resourceId,
  language,
  title,
  summary,
  translateEnabled,
}: {
  resourceId: string;
  language?: string | null;
  title: string;
  summary: string;
  translateEnabled: boolean;
}) {
  const [mode, setMode] = useState<"original" | "en">("original");
  const [enSummary, setEnSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const show = translateEnabled && likelyNeedsTranslation(`${title} ${summary}`, language ?? null);

  const translate = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (enSummary) {
        setMode(mode === "original" ? "en" : "original");
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(`/api/resources/${resourceId}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguage: "en" }),
        });
        const data = (await response.json()) as { translated?: { summary?: string } };
        if (response.ok && data.translated?.summary) {
          setEnSummary(data.translated.summary);
          setMode("en");
        }
      } finally {
        setLoading(false);
      }
    },
    [enSummary, mode, resourceId],
  );

  const display = mode === "en" && enSummary ? enSummary : summary;

  return (
    <>
      <p className="line-clamp-3 min-h-[4.125rem] shrink-0 text-sm leading-relaxed text-muted">{display}</p>
      {show ? (
        <button
          type="button"
          onClick={translate}
          className="mt-1 text-left text-[11px] font-medium text-accent hover:underline"
        >
          {loading ? "Translating…" : enSummary ? (mode === "en" ? "Show original" : "English") : "Translate to English"}
        </button>
      ) : null}
    </>
  );
}
