"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchBar({
  initialQuery = "",
  large = false,
  action = "/search",
}: {
  initialQuery?: string;
  large?: boolean;
  action?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `${action}?q=${encodeURIComponent(q)}` : action);
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <label className="sr-only" htmlFor="library-search">Search the library</label>
      <input
        id="library-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a problem, technology, place, organisation or idea…"
        className={
          large
            ? "w-full rounded-md border border-line bg-white px-4 py-3.5 text-base shadow-card placeholder:text-muted/70 focus:border-accent/40"
            : "w-full rounded-md border border-line bg-white px-3 py-2 text-sm placeholder:text-muted/70"
        }
      />
    </form>
  );
}
