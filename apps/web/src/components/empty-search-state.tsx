"use client";

interface ActiveFilter {
  key: string;
  value: string;
  label: string;
}

export function EmptySearchState({
  query,
  activeFilters,
  libraryTotal,
  onRemoveFilter,
  onClearAll,
}: {
  query: string;
  activeFilters: ActiveFilter[];
  libraryTotal: number;
  onRemoveFilter: (key: string, value: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-6 text-sm">
      <p className="font-medium text-ink">No resources matched all of these filters.</p>
      {activeFilters.length > 0 ? (
        <div className="mt-3 text-muted">
          <p>Try removing:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {activeFilters.slice(0, 5).map((filter) => (
              <li key={`${filter.key}-${filter.value}`}>
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => onRemoveFilter(filter.key, filter.value)}
                >
                  {filter.label}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-3 text-accent hover:underline" onClick={onClearAll}>
            Clear all filters
          </button>
        </div>
      ) : query ? (
        <p className="mt-2 text-muted">
          Try shorter keywords or browse from{" "}
          <a href="/" className="text-accent hover:underline">Discover</a>.
        </p>
      ) : (
        <p className="mt-2 text-muted">
          The library has {libraryTotal.toLocaleString()} resources — add a search term or pick a filter.
        </p>
      )}
    </div>
  );
}
