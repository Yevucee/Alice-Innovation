"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CandidatePreview = {
  id: string;
  name: string;
  homepage: string | null;
  notes: string;
  created_at: string;
};

export function SourceCandidateForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/source-candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          name: name.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string; duplicate?: boolean; candidate?: CandidatePreview };
      if (!response.ok) {
        setError(body.error === "invalid_url" ? "That does not look like a valid URL." : "Could not save — try again.");
        return;
      }
      if (body.duplicate) {
        setMessage("Already on the list — we kept the original entry.");
      } else {
        setMessage("Saved. This is recorded for a future source adapter (not ingested automatically).");
      }
      setUrl("");
      setName("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Could not save — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <div>
        <label htmlFor="source-candidate-url" className="block text-xs font-semibold tracking-wide text-muted uppercase">
          URL
        </label>
        <input
          id="source-candidate-url"
          type="url"
          inputMode="url"
          className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2000}
          required
        />
        <p className="mt-1 text-xs text-muted">
          Paste a homepage, programme page, award list, or directory — anywhere you spot innovations we should catalogue later.
        </p>
      </div>
      <div>
        <label htmlFor="source-candidate-name" className="block text-xs font-semibold tracking-wide text-muted uppercase">
          Label (optional)
        </label>
        <input
          id="source-candidate-name"
          type="text"
          className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
          placeholder="e.g. Nairobi tech hub portfolio, 2025 climate award finalists"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
        />
      </div>
      <div>
        <label htmlFor="source-candidate-notes" className="block text-xs font-semibold tracking-wide text-muted uppercase">
          Notes (optional)
        </label>
        <textarea
          id="source-candidate-notes"
          className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
          rows={2}
          placeholder="How you found it, what kind of listings it has…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
        />
      </div>
      {message ? <p className="text-xs text-green-800">{message}</p> : null}
      {error ? <p className="text-xs text-amber-800">{error}</p> : null}
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="rounded border border-line bg-white px-3 py-1.5 text-sm hover:border-ink/30 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Add to source ideas"}
      </button>
    </form>
  );
}
