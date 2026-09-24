"use client";

import { useMemo, useState } from "react";

export function SourceFilter({
  sources,
  selected,
  onToggle,
}: {
  sources: Array<{ id: string; name: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources.slice(0, 12);
    return sources.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 20);
  }, [query, sources]);

  return (
    <div>
      <p className="mb-2 font-medium text-ink">Source</p>
      <input
        type="search"
        placeholder="Find a source…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded border border-line px-2 py-1 text-xs"
      />
      <ul className="max-h-40 space-y-1.5 overflow-auto text-muted">
        {filtered.map((source) => (
          <li key={source.id}>
            <label className="flex cursor-pointer items-start gap-2 hover:text-ink">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.includes(source.id)}
                onChange={() => onToggle(source.id)}
              />
              <span className="text-xs leading-snug">{source.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
