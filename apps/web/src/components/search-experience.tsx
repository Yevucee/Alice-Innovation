"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CompactResource } from "@alice/database";
import { EmptySearchState } from "./empty-search-state";
import { ResourceCard } from "./resource-card";
import { SearchBar } from "./search-bar";
import { SourceFilter } from "./source-filter";

interface CategoryData {
  sectors: Array<{ slug: string; name: string }>;
  problems: Array<{ slug: string; name: string }>;
  technologies: Array<{ slug: string; name: string }>;
  resource_types: Array<{ code: string; label: string }>;
  geographies: Array<{ country_name: string; country_code: string }>;
}

interface SearchResponse {
  results: CompactResource[];
  filtered_total: number;
  library_total: number;
  vector: string;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export function SearchExperience({ libraryTotal }: { libraryTotal: number }) {
  const params = useSearchParams();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [meta, setMeta] = useState<SearchResponse | null>(null);
  const [rows, setRows] = useState<CompactResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [sourceCatalogue, setSourceCatalogue] = useState<Array<{ id: string; name: string }>>([]);

  const state = useMemo(() => ({
    q: params.get("q") ?? "",
    type: parseList(params.get("type")),
    problem: parseList(params.get("problem")),
    sector: parseList(params.get("sector")),
    tech: parseList(params.get("tech")),
    country: parseList(params.get("country")),
    stage: parseList(params.get("stage")),
    source: parseList(params.get("source")),
    mode: params.get("mode") === "diverse" ? "diverse" : "best",
    sort: params.get("sort") ?? "relevance",
    offset: Number(params.get("offset") ?? "0"),
  }), [params]);

  const filterKey = useMemo(
    () => JSON.stringify({
      q: state.q,
      type: state.type,
      problem: state.problem,
      sector: state.sector,
      tech: state.tech,
      country: state.country,
      stage: state.stage,
      source: state.source,
      mode: state.mode,
      sort: state.sort,
    }),
    [state.q, state.type, state.problem, state.sector, state.tech, state.country, state.stage, state.source, state.mode, state.sort],
  );

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.push(`/search?${next.toString()}`);
  }, [params, router]);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => setCategories(null));
    fetch("/api/sources")
      .then((r) => r.json())
      .then((json: { sources?: Array<{ id: string; name: string }> }) => setSourceCatalogue(json.sources ?? []))
      .catch(() => setSourceCatalogue([]));
  }, []);

  const labelFor = useCallback((key: string, value: string): string => {
    if (!categories) return value;
    if (key === "sector") return categories.sectors.find((s) => s.slug === value)?.name ?? value;
    if (key === "problem") return categories.problems.find((p) => p.slug === value)?.name ?? value;
    if (key === "tech") return categories.technologies.find((t) => t.slug === value)?.name ?? value;
    if (key === "type") return categories.resource_types.find((t) => t.code === value)?.label ?? value;
    if (key === "country") {
      const geo = categories.geographies.find((g) => g.country_code.toLowerCase() === value);
      return geo?.country_name ?? value;
    }
    if (key === "source") return sourceCatalogue.find((s) => s.id === value)?.name ?? value;
    return value.replace(/_/g, " ");
  }, [categories, sourceCatalogue]);

  useEffect(() => {
    setLoading(true);
    const body = {
      query: state.q,
      resource_types: state.type,
      problems: state.problem,
      sectors: state.sector,
      technologies: state.tech,
      countries: state.country,
      evidence_stages: state.stage,
      sources: state.source,
      diverse: state.mode === "diverse",
      sort: state.sort,
      limit: 20,
      offset: state.offset,
    };
    fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .then((json) => {
        const payload = json as SearchResponse;
        setMeta(payload);
        setRows((previous) => (state.offset === 0 ? payload.results : [...previous, ...payload.results]));
      })
      .finally(() => setLoading(false));
  }, [filterKey, state.offset]);

  const activeFilters = [
    ...state.type.map((v) => ({ key: "type", value: v, label: labelFor("type", v) })),
    ...state.sector.map((v) => ({ key: "sector", value: v, label: labelFor("sector", v) })),
    ...state.problem.map((v) => ({ key: "problem", value: v, label: labelFor("problem", v) })),
    ...state.tech.map((v) => ({ key: "tech", value: v, label: labelFor("tech", v) })),
    ...state.country.map((v) => ({ key: "country", value: v, label: labelFor("country", v) })),
    ...state.stage.map((v) => ({ key: "stage", value: v, label: labelFor("stage", v) })),
    ...state.source.map((v) => ({ key: "source", value: v, label: labelFor("source", v) })),
  ];

  function toggle(key: string, value: string, list: string[]) {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    updateParams({ [key]: next.length ? next.join(",") : null, offset: "0" });
  }

  function clearAll() {
    router.push(state.q ? `/search?q=${encodeURIComponent(state.q)}` : "/search");
  }

  const filterPanel = categories ? (
    <div className="space-y-6 text-sm">
      <FilterGroup title="Type" options={categories.resource_types.map((t) => ({ value: t.code, label: t.label }))}
        selected={state.type} onToggle={(v) => toggle("type", v, state.type)} />
      <FilterGroup title="Problem" options={categories.problems.slice(0, 12).map((p) => ({ value: p.slug, label: p.name }))}
        selected={state.problem} onToggle={(v) => toggle("problem", v, state.problem)} />
      <FilterGroup title="Sector" options={categories.sectors.slice(0, 14).map((s) => ({ value: s.slug, label: s.name }))}
        selected={state.sector} onToggle={(v) => toggle("sector", v, state.sector)} />
      <FilterGroup title="Technology" options={categories.technologies.slice(0, 14).map((t) => ({ value: t.slug, label: t.name }))}
        selected={state.tech} onToggle={(v) => toggle("tech", v, state.tech)} />
      <FilterGroup title="Location" options={categories.geographies.slice(0, 16).map((g) => ({ value: g.country_code.toLowerCase(), label: g.country_name }))}
        selected={state.country} onToggle={(v) => toggle("country", v, state.country)} />
      <FilterGroup title="Stage" options={["DEPLOYED", "PILOT", "PROTOTYPE", "SCALED", "IDEA"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }))}
        selected={state.stage} onToggle={(v) => toggle("stage", v, state.stage)} />
      <SourceFilter
        sources={sourceCatalogue}
        selected={state.source}
        onToggle={(v) => toggle("source", v, state.source)}
      />
    </div>
  ) : (
    <p className="text-sm text-muted">Loading filters…</p>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium tracking-tight">Search</h1>
        <div className="mt-4">
          <SearchBar initialQuery={state.q} action="/search" />
        </div>
        <p className="mt-2 text-xs text-muted">Natural language supported — use plain questions or keywords.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted">
          {meta ? `${meta.filtered_total.toLocaleString()} of ${libraryTotal.toLocaleString()} resources` : "—"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted">Results:</span>
          <button type="button" className={state.mode === "best" ? "font-medium text-ink" : "text-muted"}
            onClick={() => updateParams({ mode: null, offset: "0" })}>Best matches</button>
          <span className="text-muted">·</span>
          <button type="button" className={state.mode === "diverse" ? "font-medium text-ink" : "text-muted"}
            onClick={() => updateParams({ mode: "diverse", offset: "0" })}>Diverse approaches</button>
        </div>
        <label className="ml-auto flex items-center gap-2 text-muted">
          Sort
          <select
            className="rounded border border-line bg-white px-2 py-1 text-ink"
            value={state.sort}
            onChange={(e) => updateParams({ sort: e.target.value, offset: "0" })}
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="maturity">Most mature</option>
          </select>
        </label>
        <button type="button" className="lg:hidden rounded border border-line px-3 py-1" onClick={() => setMobileFilters(true)}>
          Filters
        </button>
      </div>

      {activeFilters.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {activeFilters.map((f) => (
            <button
              key={`${f.key}-${f.value}`}
              type="button"
              className="rounded-full border border-line px-2.5 py-0.5 hover:border-ink/30"
              onClick={() => {
                const listKey = f.key === "type" ? state.type
                  : f.key === "sector" ? state.sector
                    : f.key === "problem" ? state.problem
                      : f.key === "tech" ? state.tech
                        : f.key === "country" ? state.country
                          : f.key === "stage" ? state.stage
                            : state.source;
                toggle(f.key, f.value, listKey);
              }}
            >
              {f.label} ×
            </button>
          ))}
          <button type="button" className="text-muted underline-offset-2 hover:underline" onClick={clearAll}>Clear all</button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{filterPanel}</aside>
        <section>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-md bg-line/60" />
              ))}
            </div>
          ) : null}
          {!loading && meta && rows.length === 0 ? (
            <EmptySearchState
              query={state.q}
              activeFilters={activeFilters}
              libraryTotal={libraryTotal}
              onRemoveFilter={(key, value) => {
                const list = key === "type" ? state.type
                  : key === "sector" ? state.sector
                    : key === "problem" ? state.problem
                      : key === "tech" ? state.tech
                        : key === "country" ? state.country
                          : key === "stage" ? state.stage
                            : state.source;
                toggle(key, value, list);
              }}
              onClearAll={clearAll}
            />
          ) : null}
          {!loading && rows.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((resource) => (
                <ResourceCard key={resource.resource_id} resource={resource} />
              ))}
            </div>
          ) : null}
          {!loading && meta && meta.filtered_total > rows.length ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                className="rounded border border-line px-4 py-2 text-sm hover:border-ink/30"
                onClick={() => updateParams({ offset: String(state.offset + 20) })}
              >
                Load more
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {mobileFilters ? (
        <div className="fixed inset-0 z-50 bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-medium">Filters</p>
            <button type="button" onClick={() => setMobileFilters(false)}>Done</button>
          </div>
          <div className="overflow-auto p-4">{filterPanel}</div>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-medium text-ink">{title}</p>
      <ul className="space-y-1.5 text-muted">
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex cursor-pointer items-center gap-2 hover:text-ink">
              <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
              <span>{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
