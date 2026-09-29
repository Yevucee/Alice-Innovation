"use client";

import { useEffect, useState } from "react";

interface CollectionOption {
  slug: string;
  title: string;
}

export function AddToCollection({ resourceId }: { resourceId: string }) {
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [slug, setSlug] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((json: { collections?: CollectionOption[] }) => {
        setCollections(json.collections ?? []);
        if (json.collections?.[0]) setSlug(json.collections[0].slug);
      })
      .catch(() => setCollections([]));
  }, []);

  if (collections.length === 0) return null;

  async function add() {
    if (!slug) return;
    setStatus("idle");
    const response = await fetch(`/api/collections/${slug}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource_id: resourceId, curator_note: note }),
    });
    setStatus(response.ok ? "ok" : "error");
  }

  return (
    <div className="mt-6 rounded-md border border-line bg-white p-4 text-sm">
      <p className="font-medium">Add to collection</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          className="rounded border border-line px-2 py-1"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        >
          {collections.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
        <input
          className="min-w-[12rem] flex-1 rounded border border-line px-2 py-1"
          placeholder="Curator note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
        <button type="button" className="rounded border border-line px-3 py-1" onClick={add}>
          Add
        </button>
      </div>
      {status === "ok" ? <p className="mt-2 text-xs text-muted">Added.</p> : null}
      {status === "error" ? <p className="mt-2 text-xs text-red-600">Could not add.</p> : null}
    </div>
  );
}
