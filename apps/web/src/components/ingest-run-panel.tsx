"use client";

import { useCallback, useEffect, useState } from "react";

const SCOPES = [
  { id: "asia", label: "Run Asia", hint: "Start Asia ingest? ~60–90 min" },
  { id: "africa", label: "Run Africa", hint: "Start Africa ingest? ~60–90 min" },
  { id: "europe", label: "Run Europe", hint: "Start Europe ingest? ~60–90 min" },
  { id: "south-america", label: "Run South America", hint: "Start South America ingest? ~60–90 min" },
  { id: "grants", label: "Run Grants & research", hint: "Start grants/research ingest? ~60–90 min" },
  { id: "failed-only", label: "Retry failed only", hint: "Re-run sources that failed last time? ~30–90 min" },
  { id: "all", label: "Run all", hint: "Start full library ingest? May take several hours on manual runs." },
] as const;

type ScopeStatus = {
  scope: string;
  status: "idle" | "running" | "pending";
  started_at: string | null;
  last_result: string | null;
  last_items_new: number | null;
  last_duration_ms: number | null;
  last_requested_at: string | null;
};

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const min = Math.round(ms / 60_000);
  return `${min} min`;
}

export function IngestRunPanel() {
  const [lockHeld, setLockHeld] = useState(false);
  const [scopes, setScopes] = useState<ScopeStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/ingest-run/status");
    if (!res.ok) return;
    const data = (await res.json()) as { lock_held: boolean; scopes: ScopeStatus[] };
    setLockHeld(data.lock_held);
    setScopes(data.scopes);
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const anyActive = lockHeld || scopes.some((s) => s.status === "running" || s.status === "pending");

  async function startScope(scope: string, hint: string) {
    if (!window.confirm(hint)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ingest-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const body = (await res.json()) as {
        error?: string;
        message?: string;
        railway_message?: string;
      };
      if (!res.ok) {
        setError(
          body.railway_message
          ?? body.message
          ?? body.error
          ?? `HTTP ${res.status}`,
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusByScope = new Map(scopes.map((s) => [s.scope, s]));

  return (
    <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
      <h2 className="text-sm font-medium">Run ingest</h2>
      <p className="mt-1 text-xs text-muted">
        Scoped runs use a separate time budget from nightly cron. Buttons queue a request and start the Railway ingestor
        service (no persistent env changes).
      </p>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {SCOPES.map((scope) => (
          <button
            key={scope.id}
            type="button"
            disabled={anyActive || busy}
            className="rounded border border-line px-3 py-1.5 text-xs disabled:opacity-50"
            onClick={() => startScope(scope.id, scope.hint)}
          >
            {scope.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-xs text-muted">
        {SCOPES.map((scope) => {
          const row = statusByScope.get(scope.id);
          return (
            <li key={scope.id} className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="font-medium text-ink w-36">{scope.label}</span>
              <span>Status: {row?.status ?? (lockHeld ? "running" : "idle")}</span>
              <span>Started: {row?.started_at ? new Date(row.started_at).toLocaleString() : "—"}</span>
              <span>New: {row?.last_items_new ?? "—"}</span>
              <span>Duration: {formatDuration(row?.last_duration_ms ?? null)}</span>
              <span className="max-w-full truncate">Last: {row?.last_result ?? "—"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
