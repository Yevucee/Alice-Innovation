"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCollectionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const json = await response.json() as { slug?: string; error?: string };
    setLoading(false);
    if (!response.ok || !json.slug) {
      setError(json.error ?? "create_failed");
      return;
    }
    router.push(`/collections/${json.slug}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <h1 className="text-2xl font-medium tracking-tight">New collection</h1>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm">
          <span className="text-muted">Title</span>
          <input
            className="mt-1 w-full rounded border border-line px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Description</span>
          <textarea
            className="mt-1 w-full rounded border border-line px-3 py-2"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-ink px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
