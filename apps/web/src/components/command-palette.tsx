"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface GlobalHit {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalHit[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") close();
    }
    function onCustom() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("alice:open-search", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("alice:open-search", onCustom);
    };
  }, [close]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setHits([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/global-search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json() as { results?: GlobalHit[] };
        setHits(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [open, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0" aria-label="Close search" onClick={close} />
      <div className="relative w-full max-w-xl rounded-lg border border-line bg-white shadow-lg">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search resources, people, organisations, sources…"
          className="w-full border-b border-line px-4 py-3 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              router.push(hits[0].href);
              close();
            }
          }}
        />
        <div className="max-h-80 overflow-auto p-2 text-sm">
          {loading ? <p className="px-2 py-3 text-muted">Searching…</p> : null}
          {!loading && query && hits.length === 0 ? (
            <p className="px-2 py-3 text-muted">No matches.</p>
          ) : null}
          {hits.map((hit) => (
            <Link
              key={`${hit.type}-${hit.id}`}
              href={hit.href}
              onClick={close}
              className="block rounded px-2 py-2 hover:bg-canvas"
            >
              <p className="font-medium">{hit.title}</p>
              <p className="text-xs text-muted">{hit.type}{hit.subtitle ? ` · ${hit.subtitle}` : ""}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
