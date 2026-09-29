"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CollectionNoteForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    await fetch(`/api/collections/${slug}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBody("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form className="mt-4 space-y-2" onSubmit={submit}>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Alice note
      </label>
      <textarea
        className="w-full rounded border border-line px-3 py-2 text-sm"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Why this collection matters, how to use it…"
        maxLength={8000}
      />
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink/30 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
