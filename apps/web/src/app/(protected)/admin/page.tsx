import { browseSources, libraryStats } from "@alice/database";
import { pool } from "@/lib/db";

export default async function AdminPage() {
  const [stats, sources] = await Promise.all([
    libraryStats(pool()),
    browseSources(pool(), {}),
  ]);
  const failing = (sources as Array<Record<string, unknown>>).filter((s) => s.status === "BLOCKED" || s.status === "BROKEN");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <h1 className="text-xl font-medium">Admin</h1>
      <p className="mt-1 text-sm text-muted">Operational view — separate from the research interface.</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 text-sm">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="rounded border border-line bg-white p-4">
            <dt className="text-muted">{key}</dt>
            <dd className="text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-10">
        <h2 className="text-sm font-medium">Sources needing attention</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {failing.map((source) => (
            <li key={String(source.source_id)}>{String(source.name)} — {String(source.status)}</li>
          ))}
          {failing.length === 0 ? <li>None flagged.</li> : null}
        </ul>
      </section>
    </div>
  );
}
