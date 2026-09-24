import { Suspense } from "react";
import { libraryStats } from "@alice/database";
import { SearchExperience } from "@/components/search-experience";
import { pool } from "@/lib/db";

export default async function SearchPage() {
  const stats = await libraryStats(pool());
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading search…</p>}>
      <SearchExperience libraryTotal={stats.canonical_resources ?? 0} />
    </Suspense>
  );
}
