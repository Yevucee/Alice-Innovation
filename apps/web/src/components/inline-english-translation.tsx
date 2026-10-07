"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { ResourceTranslationPayload } from "@alice/database";
import { likelyNeedsTranslation } from "@/lib/needs-translation";
import { googleTranslatePageUrl } from "@/lib/google-translate";

function stopNav(event: React.MouseEvent) {
  event.stopPropagation();
}

async function fetchTranslation(resourceId: string): Promise<ResourceTranslationPayload> {
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
  return data.translated;
}

function TranslateControls({
  loading,
  mode,
  hasTranslation,
  onClick,
  compact,
  error,
}: {
  loading: boolean;
  mode: "original" | "english";
  hasTranslation: boolean;
  onClick: () => void;
  compact?: boolean;
  error: string | null;
}) {
  const className = compact
    ? "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
    : "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs";

  return (
    <div className={className} onClick={stopNav} onKeyDown={(e) => e.stopPropagation()} role="presentation">
      <button
        type="button"
        disabled={loading}
        onClick={(e) => {
          stopNav(e);
          onClick();
        }}
        className="font-medium text-accent hover:underline disabled:opacity-50"
      >
        {loading
          ? "Translating…"
          : hasTranslation
            ? mode === "english"
              ? "Show original"
              : "Show English"
            : "Translate to English"}
      </button>
      {!compact ? (
        <span className="text-muted">English appears here on the page (cached after first view).</span>
      ) : null}
      {error ? <span className="text-amber-800">{error}</span> : null}
    </div>
  );
}

/** Card summary: replaces text in place. */
export function InlineEnglishCardSummary({
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
  const show = translateEnabled && likelyNeedsTranslation(`${title} ${summary}`, language ?? null);
  const [mode, setMode] = useState<"original" | "english">("original");
  const [translated, setTranslated] = useState<ResourceTranslationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displaySummary = mode === "english" && translated?.summary ? translated.summary : summary;

  const onClick = useCallback(async () => {
    if (translated) {
      setMode(mode === "english" ? "original" : "english");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTranslation(resourceId);
      setTranslated(result);
      setMode("english");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, resourceId, translated]);

  return (
    <>
      <p className="line-clamp-3 min-h-[4.125rem] shrink-0 text-sm leading-relaxed text-muted">{displaySummary}</p>
      {show ? (
        <>
          <TranslateControls
            compact
            loading={loading}
            mode={mode}
            hasTranslation={Boolean(translated)}
            onClick={() => void onClick()}
            error={error}
          />
          {sourcePageUrl?.trim() ? (
            <a
              href={googleTranslatePageUrl(sourcePageUrl.trim())}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[10px] text-muted hover:underline"
              onClick={stopNav}
            >
              Or open source page in Google Translate ↗
            </a>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const SECTION_KEYS: Array<{ key: keyof ResourceTranslationPayload; label: string }> = [
  { key: "problem_statement", label: "The problem" },
  { key: "how_it_works", label: "How it works" },
  { key: "why_it_is_interesting", label: "Why it is interesting" },
  { key: "intended_users", label: "Who it is for" },
  { key: "implementation_requirements", label: "Implementation" },
  { key: "excerpt", label: "Source information" },
];

/** Resource detail: title, summary, and optional sections in place. */
export function InlineEnglishResourceDetail({
  resourceId,
  language,
  original,
  translateEnabled,
  sourcePageUrl,
  metaAfterSummary,
}: {
  resourceId: string;
  language: string | null;
  original: ResourceTranslationPayload;
  translateEnabled: boolean;
  sourcePageUrl?: string | null;
  metaAfterSummary: ReactNode;
}) {
  const sample = [original.title, original.summary, original.excerpt].filter(Boolean).join(" ");
  const show = translateEnabled && likelyNeedsTranslation(sample, language);
  const [mode, setMode] = useState<"original" | "english">("original");
  const [translated, setTranslated] = useState<ResourceTranslationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = mode === "english" && translated ? translated : original;

  const onClick = useCallback(async () => {
    if (translated) {
      setMode(mode === "english" ? "original" : "english");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTranslation(resourceId);
      setTranslated(result);
      setMode("english");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, resourceId, translated]);

  const sections = SECTION_KEYS.filter(({ key }) => {
    const text = active[key];
    return typeof text === "string" && text.trim().length > 0;
  });

  return (
    <>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{active.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{active.summary}</p>
      {show ? (
        <>
          <TranslateControls
            loading={loading}
            mode={mode}
            hasTranslation={Boolean(translated)}
            onClick={() => void onClick()}
            error={error}
          />
          {sourcePageUrl?.trim() ? (
            <p className="mt-1 text-xs text-muted">
              <a
                href={googleTranslatePageUrl(sourcePageUrl.trim())}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent hover:underline"
              >
                Translate full source page in Google ↗
              </a>
            </p>
          ) : null}
        </>
      ) : null}
      {metaAfterSummary}
      {sections.length > 0 ? (
        <div className="mt-10 space-y-8 text-sm leading-relaxed">
          {sections.map(({ key, label }) => (
            <section key={key}>
              <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</h2>
              <p className={`mt-2 whitespace-pre-wrap ${key === "excerpt" ? "text-muted" : ""}`}>
                {String(active[key])}
              </p>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
}
