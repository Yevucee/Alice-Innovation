"use client";

import { useCallback, useMemo, useState } from "react";
import type { ResourceTranslationPayload } from "@alice/database";
import { likelyNeedsTranslation } from "@/lib/needs-translation";

const SECTION_LABELS: Array<{ key: keyof ResourceTranslationPayload; label: string }> = [
  { key: "problem_statement", label: "The problem" },
  { key: "how_it_works", label: "How it works" },
  { key: "why_it_is_interesting", label: "Why it is interesting" },
  { key: "intended_users", label: "Who it is for" },
  { key: "implementation_requirements", label: "Implementation" },
  { key: "excerpt", label: "Source information" },
];

export function ResourceTranslatePanel({
  resourceId,
  language,
  original,
  translateEnabled,
  typeLabel,
  isPick,
  metaLineText,
  evidenceBasisLabel,
  showExcerptSection,
}: {
  resourceId: string;
  language: string | null;
  original: ResourceTranslationPayload;
  translateEnabled: boolean;
  typeLabel: string;
  isPick: boolean;
  metaLineText: string;
  evidenceBasisLabel: string | null;
  showExcerptSection: boolean;
}) {
  const sampleText = useMemo(
    () => [original.title, original.summary, original.excerpt].filter(Boolean).join(" "),
    [original],
  );
  const showOffer = translateEnabled && likelyNeedsTranslation(sampleText, language);
  const [mode, setMode] = useState<"original" | "translated">("original");
  const [translated, setTranslated] = useState<ResourceTranslationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = mode === "translated" && translated ? translated : original;

  const runTranslate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/resources/${resourceId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: "en" }),
      });
      const data = (await response.json()) as {
        translated?: ResourceTranslationPayload;
        error?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message || data.error || "Translation failed");
      if (!data.translated) throw new Error("Empty translation");
      setTranslated(data.translated);
      setMode("translated");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  const sections = SECTION_LABELS.filter(({ key }) => {
    if (key === "excerpt" && !showExcerptSection) return false;
    const text = active[key];
    return typeof text === "string" && text.trim().length > 0;
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{typeLabel}</p>
        {isPick ? (
          <span className="rounded bg-ink px-2 py-0.5 text-[10px] font-medium tracking-wide text-white">
            ALICE PICK
          </span>
        ) : null}
      </div>
      {showOffer ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (translated) setMode(mode === "translated" ? "original" : "translated");
              else void runTranslate();
            }}
            className="rounded border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-ink/30 disabled:opacity-50"
          >
            {loading
              ? "Translating…"
              : translated
                ? mode === "translated"
                  ? "Show original"
                  : "Show English"
                : "Translate to English"}
          </button>
          {translated && mode === "translated" ? (
            <span className="text-xs text-muted">Machine translation — verify against source.</span>
          ) : null}
          {error ? <span className="text-xs text-amber-800">{error}</span> : null}
        </div>
      ) : null}
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{active.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{active.summary}</p>
      <p className="mt-3 text-sm text-muted">{metaLineText}</p>
      {evidenceBasisLabel ? (
        <p className="mt-2 text-xs text-muted" title="How we know this maturity level">
          Evidence: {evidenceBasisLabel}
        </p>
      ) : null}
      {sections.length > 0 ? (
        <div className="mt-10 space-y-8 text-sm leading-relaxed">
          {sections.map(({ key, label }) => (
            <section key={key}>
              <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</h2>
              <p className="mt-2 whitespace-pre-wrap">{String(active[key])}</p>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}
