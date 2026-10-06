"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SourceCandidateListItem = {
  id: string;
  name: string;
  homepage: string | null;
  notes: string;
  status: string;
  source_slug: string | null;
  created_at: string;
};

export function SourceCandidateList({ items }: { items: SourceCandidateListItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function promote(id: string) {
    setLoadingId(id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/source-candidates/${id}/promote`, { method: "POST" });
      const body = (await response.json()) as { error?: string; source_slug?: string; registry_updated?: boolean };
      if (!response.ok) {
        setError(body.error === "not_found" ? "Entry not found." : "Could not add to ingest list.");
        return;
      }
      const slug = body.source_slug ?? "";
      setMessage(
        slug
          ? `Added to ingest list as ${slug}. The next ingest run can crawl it (PARTIAL html-catalogue).`
          : "Added to ingest list.",
      );
      router.refresh();
    } catch {
      setError("Could not add to ingest list.");
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-6 space-y-3 border-t border-line pt-4 text-xs text-muted">
      <p className="font-medium text-ink">Recent ideas</p>
      {message ? <p className="text-green-800">{message}</p> : null}
      {error ? <p className="text-amber-800">{error}</p> : null}
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id} className="rounded border border-line bg-slate-50 p-3">
            <p className="font-medium text-ink">{row.name}</p>
            {row.homepage ? (
              <a href={row.homepage} className="text-accent hover:underline break-all" target="_blank" rel="noreferrer">
                {row.homepage}
              </a>
            ) : null}
            {row.notes ? <p className="mt-1">{row.notes}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {row.source_slug ? (
                <Link href={`/sources/${row.source_slug}`} className="text-accent hover:underline">
                  On ingest list · {row.source_slug}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={loadingId === row.id}
                  onClick={() => promote(row.id)}
                  className="rounded border border-line bg-white px-2 py-1 text-xs hover:border-ink/30 disabled:opacity-50"
                >
                  {loadingId === row.id ? "Adding…" : "Add to ingest list"}
                </button>
              )}
              <span className="text-muted">{row.status.replace(/_/g, " ").toLowerCase()}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
