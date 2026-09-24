"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface OrgRow {
  organisation_id: string;
  name: string;
  organisation_type?: string;
  country?: string;
  description?: string;
  resources?: unknown[];
}

export default function OrganisationsPage() {
  const [query, setQuery] = useState("");
  const [orgs, setOrgs] = useState<OrgRow[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/organisations?q=${encodeURIComponent(query)}`);
      const data = await res.json() as { results: OrgRow[] };
      setOrgs(data.results ?? []);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-medium">Organisations</h1>
      <input
        className="mt-6 w-full max-w-md rounded-md border border-line px-3 py-2 text-sm"
        placeholder="Search organisations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {orgs.map((org) => (
          <li key={org.organisation_id} className="rounded-md border border-line p-4">
            <Link href={`/organisations/${org.organisation_id}`} className="font-medium hover:text-accent">
              {org.name}
            </Link>
            <p className="mt-1 text-xs text-muted">{[org.organisation_type, org.country].filter(Boolean).join(" · ")}</p>
            {org.description ? <p className="mt-2 line-clamp-3 text-sm text-muted">{org.description}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
