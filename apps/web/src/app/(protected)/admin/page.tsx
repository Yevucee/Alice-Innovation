import Link from "next/link";
import {
  browseSources,
  embeddingAdminStatus,
  enrichmentAdminStatus,
  libraryStats,
  listRecentIngestionRuns,
  latestSourcePreviewReports,
  postDeployJobsAdminPanel,
  qualityAdminStatus,
} from "@alice/database";
import { formatDate } from "@/lib/format";
import { pool } from "@/lib/db";

export default async function AdminPage() {
  const [stats, sources, runs, embeddings, quality, enrichment, previews, postDeploy] = await Promise.all([
    libraryStats(pool()),
    browseSources(pool(), {}),
    listRecentIngestionRuns(pool(), 12),
    embeddingAdminStatus(pool()).catch(() => null),
    qualityAdminStatus(pool()).catch(() => null),
    enrichmentAdminStatus(pool()).catch(() => null),
    latestSourcePreviewReports(pool(), 6).catch(() => []),
    postDeployJobsAdminPanel(pool()).catch(() => null),
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
          {quality.review_breakdown ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs text-muted">
              <div>
                <p className="font-medium text-ink">By source (top)</p>
                <ul className="mt-1 space-y-1">
                  {quality.review_breakdown.by_source.map((row) => (
                    <li key={row.source_slug}>
                      {row.source_slug}: {row.count.toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium text-ink">By reason</p>
                <ul className="mt-1 space-y-1">
                  {Object.entries(quality.review_breakdown.by_reason)
                    .sort((a, b) => b[1] - a[1])
                    .map(([code, count]) => (
                      <li key={code}>
                        {code.replace(/_/g, " ")}: {count.toLocaleString()}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ) : null}
          {quality.last_run ? (
            <p className="mt-2 text-xs text-muted">
              Last audit flagged {String(quality.last_run.flagged)} of {String(quality.last_run.scanned)} scanned
            </p>
          ) : null}
        </section>
      ) : null}

      {previews.length > 0 ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">Source preview (dry-run)</h2>
          <p className="mt-1 text-xs text-muted">
            From <code className="text-ink">npm run ingest -- --source &lt;slug&gt; --limit 20 --dry-run</code> or{" "}
            <code className="text-ink">INGEST_SOURCE_PREVIEW_SLUG</code>.
          </p>
          <ul className="mt-4 space-y-3 text-xs text-muted">
            {previews.map((row) => {
              const report = row.report as {
                flagged_pct?: number;
                sampled?: number;
                flagged?: number;
                samples?: Array<{ title: string; needs_review: boolean; reasons: string[] }>;
              };
              return (
                <li key={`${row.source_slug}-${String(row.created_at)}`} className="border-t border-line pt-3">
                  <p className="font-medium text-ink">
                    {row.source_slug} — {String(report.flagged_pct ?? "—")}% flagged ({String(report.flagged)}/
                    {String(report.sampled)})
                  </p>
                  <p className="mt-1">{formatDate(String(row.created_at))}</p>
                  {report.samples?.slice(0, 3).map((sample, index) => (
                    <p key={index} className="mt-1 truncate">
                      {sample.needs_review ? "⚠ " : "✓ "}
                      {sample.title} {sample.reasons?.length ? `[${sample.reasons.join(", ")}]` : ""}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {postDeploy ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">Post-deploy jobs</h2>
          <p className="mt-1 text-xs text-muted">Read-only queue state from <code className="text-ink">post_deploy_jobs</code>.</p>
          {postDeploy.last_run_budget.minutes_used != null ? (
            <p className="mt-2 text-muted">
              Last ingest post-deploy activity: ~{postDeploy.last_run_budget.minutes_used} min (
              {postDeploy.last_run_budget.jobs_touched} job
              {postDeploy.last_run_budget.jobs_touched === 1 ? "" : "s"} touched
              {postDeploy.last_run_budget.ingest_completed_at
                ? ` · ingest finished ${formatDate(String(postDeploy.last_run_budget.ingest_completed_at))}`
                : ""}
              ). Budget cap on ingestor:{" "}
              <code className="text-ink">POST_DEPLOY_JOBS_MAX_MINUTES</code> (default 30).
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">{postDeploy.last_run_budget.note}</p>
          )}
          <ul className="mt-4 space-y-4">
            {postDeploy.jobs.map((job) => (
              <li key={job.job_key} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">{job.job_key}</p>
                  <span className="text-xs uppercase tracking-wide text-muted">{job.display_status}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{job.description}</p>
                <p className="mt-1 text-xs text-muted">Updated {formatDate(String(job.updated_at))}</p>
                {job.counters.length > 0 ? (
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2 text-xs text-muted">
                    {job.counters.map((row) => (
                      <div key={`${job.job_key}-${row.key}`}>
                        <dt>{row.label}</dt>
                        <dd className="text-ink">{String(row.value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-muted">No progress counters stored yet.</p>
                )}
                {job.skipped.length > 0 ? (
                  <div className="mt-2 text-xs text-muted">
                    <p className="font-medium text-ink">Skipped sources / hosts</p>
                    <ul className="mt-1 space-y-1">
                      {job.skipped.map((row) => (
                        <li key={`${job.job_key}-${row.key}`}>
                          {row.key}: {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {job.last_error ? (
                  <p className="mt-2 text-xs text-amber-800">Last error: {job.last_error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {enrichment ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">LLM enrichment</h2>
          {enrichment.paused_budget ? (
            <p className="mt-2 font-medium text-amber-800">Paused — OpenRouter limit reached</p>
          ) : null}
          <p className="mt-2 text-muted">
            Pending (never attempted): {enrichment.pending.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">
            Missing country: {enrichment.missing_country.toLocaleString()} · stage:{" "}
            {enrichment.missing_stage.toLocaleString()} · organisation:{" "}
            {enrichment.missing_org.toLocaleString()}
          </p>
          {enrichment.last_run ? (
            <p className="mt-2 text-xs text-muted">
              Last run — attempted {String(enrichment.last_run.attempted ?? enrichment.last_run.processed)} · applied{" "}
              {String(enrichment.last_run.applied ?? enrichment.last_run.enriched)} · no data{" "}
              {String(enrichment.last_run.no_data ?? "—")} · est. cost USD{" "}
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
                <dt>Priority queue / re-embedded</dt>
                <dd className="text-ink">
                  {String(embeddings.last_run.priority_queued ?? "—")} /{" "}
                  {String(embeddings.last_run.priority_embedded ?? "—")}
                  {embeddings.last_run.priority_failed != null &&
                  Number(embeddings.last_run.priority_failed) > 0
                    ? ` (${String(embeddings.last_run.priority_failed)} failed)`
                    : null}
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
