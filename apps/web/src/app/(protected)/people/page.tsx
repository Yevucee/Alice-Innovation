"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface PersonRow {
  person_id: string;
  name: string;
  role?: string;
  country?: string;
  organisation?: string;
}

export default function PeoplePage() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonRow[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/people?q=${encodeURIComponent(query)}`);
      const data = await res.json() as { results: PersonRow[] };
      setPeople(data.results ?? []);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-medium">People</h1>
      <p className="mt-2 text-sm text-muted">Innovators, engineers, researchers and founders linked to library resources.</p>
      <input
        className="mt-6 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm"
        placeholder="Search people…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {people.map((person) => (
          <li key={person.person_id} className="py-4">
            <Link href={`/people/${person.person_id}`} className="font-medium hover:text-accent">
              {person.name}
            </Link>
            <p className="text-sm text-muted">
              {[person.role, person.organisation, person.country].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
      {people.length === 0 ? <p className="mt-6 text-sm text-muted">No people indexed yet.</p> : null}
    </div>
  );
}
