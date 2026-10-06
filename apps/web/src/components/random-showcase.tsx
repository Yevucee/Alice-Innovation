"use client";

import { useCallback, useState } from "react";
import type { CompactResource } from "@alice/database";
import { ResourceCard } from "./resource-card";

export function RandomShowcase({ initial }: { initial: CompactResource | null }) {
  const [resource, setResource] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnother = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const exclude = resource ? `?exclude=${encodeURIComponent(resource.resource_id)}` : "";
      const response = await fetch(`/api/discover/random${exclude}`);
      const json = (await response.json()) as { resource?: CompactResource | null; error?: string };
      if (!response.ok || !json.resource) {
        throw new Error(json.error ?? "Could not load another innovation.");
      }
      setResource(json.resource);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load another innovation.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  if (!resource) {
    return null;
  }

  return (
    <section className="border-b border-line bg-accent-soft/30">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <h2 className="text-lg font-medium">Spotlight</h2>
          <p className="mt-1 text-sm text-muted">One innovation from the library, chosen at random.</p>
          <button
            type="button"
            className="mt-5 rounded border border-line bg-white px-5 py-2.5 text-sm font-medium hover:border-ink/30 disabled:opacity-50"
            onClick={() => void loadAnother()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Random innovation"}
          </button>
          {error ? (
            <p className="mt-4 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-8 w-full">
            <ResourceCard resource={resource} />
          </div>
        </div>
      </div>
    </section>
  );
}
