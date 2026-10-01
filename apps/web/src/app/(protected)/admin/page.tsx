import Link from "next/link";
import {
  browseSources,
  embeddingAdminStatus,
  enrichmentAdminStatus,
  libraryStats,
  listRecentIngestionRuns,
  qualityAdminStatus,
} from "@alice/database";
import { formatDate } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function AdminPage() {
  const [stats, sources, runs, embeddings, quality, enrichment] = await Promise.all([
    libraryStats(pool()),
    browseSources(pool(), {}),
    listRecentIngestionRuns(pool(), 12),
    embeddingAdminStatus(pool()).catch(() => null),
    qualityAdminStatus(pool()).catch(() => null),
    enrichmentAdminStatus(pool()).catch(() => null),
  ]);
  const failing = (sources as Array<Record<string, unknown>>).filter((s) =>
    s.status === "BLOCKED" || s.status === "BROKEN" || s.status === "PARTIAL",
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <h1 className="text-xl font-medium">Admin</h1>
      <p className="mt-1 text-sm text-muted">Operational view — separate from the research interface.</p>
      <p className="mt-2 text-xs text-muted">
        Deploy checklist: <code className="text-ink">docs/railway-checklist.md</code>
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="rounded border border-line bg-white p-4">
            <dt className="text-muted">{key.replace(/_/g, " ")}</dt>
            <dd className="text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {quality ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">Quality review</h2>
          <p className="mt-2 text-muted">
            Resources flagged NEEDS_REVIEW: {quality.needs_review.toLocaleString()}
          </p>
          {quality.last_run ? (
            <p className="mt-2 text-xs text-muted">
              Last audit flagged {String(quality.last_run.flagged)} of {String(quality.last_run.scanned)} scanned
            </p>
          ) : null}
        </section>
      ) : null}

      {enrichment ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">LLM enrichment</h2>
          <p className="mt-2 text-muted">Pending resources: {enrichment.pending.toLocaleString()}</p>
          {enrichment.last_run ? (
            <p className="mt-2 text-xs text-muted">
              Last run enriched {String(enrichment.last_run.enriched)} · est. cost USD{" "}
              {String(enrichment.last_run.estimated_cost_usd)}
            </p>
          ) : null}
        </section>
      ) : null}

      {embeddings ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">Search embeddings</h2>
          <p className="mt-2 text-muted">
            Active resources: {embeddings.coverage.active.toLocaleString()} · embedded:{" "}
            {embeddings.coverage.with_embedding.toLocaleString()} ({embeddings.coverage.pct}%)
          </p>
          {embeddings.last_run ? (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-muted">
              <div>
                <dt>Last backfill</dt>
                <dd className="text-ink">{formatDate(String(embeddings.last_run.completed_at))}</dd>
              </div>
              <div>
                <dt>Embedded / failed</dt>
                <dd className="text-ink">
                  {String(embeddings.last_run.embedded)} / {String(embeddings.last_run.failed)}
                </dd>
              </div>
              <div>
                <dt>Est. cost (USD)</dt>
                <dd className="text-ink">{String(embeddings.last_run.estimated_cost_usd)}</dd>
              </div>
              <div>
                <dt>Coverage after run</dt>
                <dd className="text-ink">{String(embeddings.last_run.pct_embedded)}%</dd>
              </div>
              {embeddings.last_run.note ? (
                <div className="sm:col-span-2">
                  <dt>Note</dt>
                  <dd className="text-ink">{String(embeddings.last_run.note)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-muted">No backfill run recorded yet (migration 005 + ingestor post-pass).</p>
          )}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium">Recent ingestion runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">New</th>
                <th className="pb-2 pr-4">Updated</th>
                <th className="pb-2">Started</th>
              </tr>
            </thead>
            <tbody>
              {(runs as Array<Record<string, unknown>>).map((run) => (
                <tr key={String(run.run_id)} className="border-t border-line">
                  <td className="py-2 pr-4">
                    {run.source_id ? (
                      <Link href={`/sources/${run.source_id}`} className="text-accent hover:underline">
                        {String(run.source_name ?? run.source_id)}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="py-2 pr-4">{String(run.status)}</td>
                  <td className="py-2 pr-4">{String(run.items_new)}</td>
                  <td className="py-2 pr-4">{String(run.items_updated)}</td>
                  <td className="py-2">{formatDate(run.started_at as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 ? <p className="mt-2 text-sm text-muted">No runs recorded yet.</p> : null}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Sources needing attention</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {failing.map((source) => (
            <li key={String(source.source_id)}>
              <Link href={`/sources/${source.source_id}`} className="text-accent hover:underline">
                {String(source.name)}
              </Link>
              {" — "}{String(source.status)}
            </li>
          ))}
          {failing.length === 0 ? <li>None flagged.</li> : null}
        </ul>
      </section>
    </div>
  );
}
