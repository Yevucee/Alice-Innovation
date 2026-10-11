"use client";

import { useCallback, useEffect, useState } from "react";

type QueueRow = {
  id: string;
  canonical_title: string;
  source_slug: string | null;
  canonical_url: string | null;
  review_reason_codes: string[];
  updated_at: string;
};

export function ReviewQueuePanel() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [source, setSource] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (source.trim()) params.set("source", source.trim());
    if (reason.trim()) params.set("reason", reason.trim());
    const res = await fetch(`/api/admin/review-queue?${params}`);
    const body = await res.json();
    if (res.ok) {
      setRows(body.rows ?? []);
      setTotal(body.total ?? 0);
    }
    setLoading(false);
  }, [offset, source, reason]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "source_limited" | "hide") {
    const res = await fetch("/api/admin/review-queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource_id: id, action }),
    });
    if (res.ok) void load();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Source</span>
          <input
            className="rounded border border-line px-2 py-1"
            value={source}
            onChange={(e) => { setSource(e.target.value); setOffset(0); }}
            placeholder="mit-solve"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Reason</span>
          <input
            className="rounded border border-line px-2 py-1"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setOffset(0); }}
            placeholder="truncated_title"
          />
        </label>
        <button type="button" className="rounded border border-line px-3 py-1" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <p className="text-xs text-muted">
        {total.toLocaleString()} items NEEDS_REVIEW
        {loading ? " — loading…" : ""}
      </p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2 pr-2">Title</th>
            <th className="py-2 pr-2">Source</th>
            <th className="py-2 pr-2">Reasons</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line align-top">
              <td className="py-2 pr-2 max-w-xs">
                <div className="font-medium text-ink">{row.canonical_title}</div>
                {row.canonical_url ? (
                  <a href={row.canonical_url} className="text-muted underline break-all" target="_blank" rel="noreferrer">
                    Source page
                  </a>
                ) : null}
              </td>
              <td className="py-2 pr-2">{row.source_slug ?? "—"}</td>
              <td className="py-2 pr-2">{row.review_reason_codes.join(", ") || "—"}</td>
              <td className="py-2 space-x-1 whitespace-nowrap">
                <button type="button" className="rounded border border-line px-2 py-0.5" onClick={() => void act(row.id, "approve")}>
                  Approve
                </button>
                <button type="button" className="rounded border border-line px-2 py-0.5" onClick={() => void act(row.id, "source_limited")}>
                  Source-limited
                </button>
                <button type="button" className="rounded border border-line px-2 py-0.5" onClick={() => void act(row.id, "hide")}>
                  Hide
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-line px-3 py-1 disabled:opacity-40"
          disabled={offset <= 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded border border-line px-3 py-1 disabled:opacity-40"
          disabled={offset + limit >= total}
          onClick={() => setOffset(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
