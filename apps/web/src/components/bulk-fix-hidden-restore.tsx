"use client";

import { useState } from "react";

export function BulkFixHiddenRestore() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function restoreAll() {
    if (!window.confirm("Restore all ARCHIVED rows hidden by bulk-fix junk codes (junk_generic_title / junk_duplicate_title_content)?")) {
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/review-queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "restore_bulk_fix_hidden_all" }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.ok) {
      setStatus(`Restored ${body.restored ?? 0} row(s) (had ${body.hidden_before ?? "?"} matching).`);
    } else {
      setStatus(body.error ?? "Restore failed");
    }
  }

  return (
    <div className="mb-6 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-ink">Bulk-fix hidden rows</p>
      <p className="mt-1 text-xs text-muted">
        Reverses bulk-fix hide (junk_* reason codes): sets <code>active=true</code> and{" "}
        <code>NEEDS_REVIEW</code>, keeping prior reason codes for triage.
      </p>
      <button
        type="button"
        className="mt-2 rounded border border-line bg-white px-3 py-1 text-xs disabled:opacity-50"
        disabled={busy}
        onClick={() => void restoreAll()}
      >
        {busy ? "Restoring…" : "Restore all bulk-fix hidden"}
      </button>
      {status ? <p className="mt-2 text-xs text-muted">{status}</p> : null}
    </div>
  );
}
