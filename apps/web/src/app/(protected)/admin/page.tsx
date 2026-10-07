import Link from "next/link";
import {
  browseSources,
  embeddingAdminStatus,
  enrichmentAdminStatus,
  libraryStats,
  listRecentIngestionRuns,
  listSourceCandidates,
  latestSourcePreviewReports,
  postDeployJobsAdminPanel,
  qualityAdminStatus,
  asiaIngestAdminSummary,
} from "@alice/database";
import { formatDate, formatDateTime } from "@/lib/format";
import { pool } from "@/lib/db";
import { SourceCandidateForm } from "@/components/source-candidate-form";
import { SourceCandidateList } from "@/components/source-candidate-list";

export default async function AdminPage() {
  const [stats, sources, runs, embeddings, quality, enrichment, previews, postDeploy, sourceIdeas, asiaIngest] = await Promise.all([
    libraryStats(pool()),
    browseSources(pool(), {}),
    listRecentIngestionRuns(pool(), 12),
    embeddingAdminStatus(pool()).catch(() => null),
    qualityAdminStatus(pool()).catch(() => null),
    enrichmentAdminStatus(pool()).catch(() => null),
    latestSourcePreviewReports(pool(), 6).catch(() => []),
    postDeployJobsAdminPanel(pool()).catch(() => null),
    listSourceCandidates(pool(), 12).catch(() => []),
    asiaIngestAdminSummary(pool()).catch(() => null),
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

      <section className="mt-8 rounded border border-line bg-white p-4 text-sm">
        <h2 className="text-sm font-medium">Suggest a new source</h2>
        <p className="mt-1 text-xs text-muted">
          Drop a link to a tech hub, award, directory, or programme page. It is stored in{" "}
          <code className="text-ink">source_candidates</code> for later adapter work — nothing is crawled until you click{" "}
          <strong className="font-medium text-ink">Add to ingest list</strong> (creates an enabled PARTIAL source for the next ingest run).
        </p>
        <SourceCandidateForm />
        <SourceCandidateList
          items={sourceIdeas.map((row) => ({
            id: row.id,
            name: row.name,
            homepage: row.homepage,
            notes: row.notes,
            status: row.status,
            source_slug: row.source_slug,
            created_at: String(row.created_at),
          }))}
        />
      </section>

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
          {quality.backlog_run ? (
            <div className="mt-4 rounded border border-line bg-slate-50 p-3 text-xs text-muted">
              <p className="font-medium text-ink">Last backlog run ({quality.backlog_run.trigger})</p>
              <p className="mt-1">
                NEEDS_REVIEW {quality.backlog_run.needs_review_before.toLocaleString()} →{" "}
                {quality.backlog_run.needs_review_after.toLocaleString()} (net{" "}
                {quality.backlog_run.net_change >= 0 ? "+" : ""}
                {quality.backlog_run.net_change.toLocaleString()})
              </p>
              <p className="mt-1">
                Cleared {quality.backlog_run.cleared.toLocaleString()} · SOURCE_LIMITED{" "}
                {quality.backlog_run.source_limited.toLocaleString()} · still flagged{" "}
                {quality.backlog_run.still_flagged.toLocaleString()} · newly flagged{" "}
                {quality.backlog_run.newly_flagged.toLocaleString()}
              </p>
            </div>
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

      {asiaIngest ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">Asia ingest</h2>
          <p className="mt-1 text-xs text-muted">
            Enabled <code className="text-ink">asia-innovation</code> sources: {asiaIngest.enabled_sources}. First-run
            ingest caps at <code className="text-ink">INGEST_FIRST_RUN_ITEM_LIMIT</code> (default 80) with quality gate
            on. See <code className="text-ink">docs/asia-ingest-expected-failures.md</code>.
          </p>
          {asiaIngest.failed_latest.length > 0 ? (
            <div className="mt-3 text-xs text-amber-900">
              <p className="font-medium text-ink">Latest run failed ({asiaIngest.failed_latest.length})</p>
              <ul className="mt-1 space-y-1">
                {asiaIngest.failed_latest.slice(0, 12).map((row) => (
                  <li key={row.slug}>
                    {row.slug}
                    {row.error_summary ? ` — ${row.error_summary}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {asiaIngest.zero_discover_slugs.length > 0 ? (
            <div className="mt-3 text-xs text-muted">
              <p className="font-medium text-ink">Zero discover on last run ({asiaIngest.zero_discover_slugs.length})</p>
              <p className="mt-1 break-words">{asiaIngest.zero_discover_slugs.slice(0, 20).join(", ")}</p>
            </div>
          ) : null}
          <div className="mt-4 max-h-64 overflow-y-auto text-xs text-muted">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-ink">
                  <th className="py-1 pr-2 font-medium">Source</th>
                  <th className="py-1 pr-2 font-medium">Items</th>
                  <th className="py-1 pr-2 font-medium">New 7d</th>
                  <th className="py-1 font-medium">Last run</th>
                </tr>
              </thead>
              <tbody>
                {asiaIngest.per_source.slice(0, 40).map((row) => (
                  <tr key={row.slug} className="border-b border-line/60">
                    <td className="py-1 pr-2 text-ink">{row.slug}</td>
                    <td className="py-1 pr-2">{row.item_count}</td>
                    <td className="py-1 pr-2">{row.items_new_7d}</td>
                    <td className="py-1">
                      {row.last_run_status ?? "—"}
                      {row.last_run_discovered != null ? ` · disc ${row.last_run_discovered}` : ""}
                      {row.last_run_new != null ? ` · new ${row.last_run_new}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {postDeploy ? (
        <section className="mt-10 rounded border border-line bg-white p-4 text-sm">
          <h2 className="text-sm font-medium">Post-deploy jobs</h2>
          <p className="mt-1 text-xs text-muted">Read-only queue state from <code className="text-ink">post_deploy_jobs</code>.</p>
          <p className="mt-2 text-xs text-muted">{postDeploy.last_run_budget.note}</p>
          {postDeploy.last_run_budget.minutes_used != null ? (
            <p className="mt-2 text-muted">
              Last post-deploy window: ~{postDeploy.last_run_budget.minutes_used} min (
              {postDeploy.last_run_budget.jobs_touched} job
              {postDeploy.last_run_budget.jobs_touched === 1 ? "" : "s"} touched
              {postDeploy.last_run_budget.runner_stop_reason
                ? ` · stop ${postDeploy.last_run_budget.runner_stop_reason}`
                : ""}
              {postDeploy.last_run_budget.ingest_completed_at
                ? ` · after ingest ${formatDateTime(String(postDeploy.last_run_budget.ingest_completed_at))}`
                : ""}
              ). Session cap: <code className="text-ink">POST_DEPLOY_JOBS_MAX_MINUTES</code> (default 30); per job{" "}
              <code className="text-ink">POST_DEPLOY_JOB_MAX_MINUTES</code> (default 15).
            </p>
          ) : null}
          <ul className="mt-4 space-y-4">
            {postDeploy.jobs.map((job) => (
              <li key={job.job_key} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">{job.job_key}</p>
                  <span className="text-xs uppercase tracking-wide text-muted">{job.display_status}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{job.description}</p>
                <p className="mt-1 text-xs text-muted">
                  Updated {formatDateTime(String(job.updated_at))}
                </p>
                {job.last_run ? (
                  <p className="mt-2 text-xs text-muted">
                    Last runner session ({job.last_run.trigger}): {formatDateTime(job.last_run.started_at)} →{" "}
                    {formatDateTime(job.last_run.ended_at)} · {job.last_run.minutes_used} min · {job.last_run.steps}{" "}
                    step{job.last_run.steps === 1 ? "" : "s"} · {job.last_run.rounds} round
                    {job.last_run.rounds === 1 ? "" : "s"} · stop {job.last_run.stop_reason}
                    {job.last_run.offset_before != null || job.last_run.offset_after != null
                      ? ` · offset ${job.last_run.offset_before ?? "—"}→${job.last_run.offset_after ?? "—"}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted">No runner session recorded yet (stored in progress.last_run).</p>
                )}
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
