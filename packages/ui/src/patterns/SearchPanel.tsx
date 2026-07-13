// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/ui — SearchPanel pattern (search surface with declarative filters).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Spinner } from "../components/feedback/Spinner";
import { Input } from "../components/input/Input";
import { Select } from "../components/input/Select";

export type SearchFilterOption = Readonly<{
  label: string;
  value: string;
}>;

export type SearchFilterDef = Readonly<
  | {
      name: string;
      label: string;
      type: "text";
      placeholder?: string;
      defaultValue?: string;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: readonly SearchFilterOption[];
      placeholder?: string;
      defaultValue?: string;
    }
  | {
      name: string;
      label: string;
      type: "date-range";
      defaultValue?: Readonly<{
        from?: string;
        to?: string;
      }>;
    }
>;

export type SearchFilterValue = string | Readonly<{ from: string; to: string }>;
export type SearchFilterValues = Readonly<Record<string, SearchFilterValue>>;

export type SearchPanelProps = Readonly<{
  onSearch: (query: string, filters: SearchFilterValues) => void;
  filters: readonly SearchFilterDef[];
  results: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerActions?: React.ReactNode;
  scopeControls?: React.ReactNode;
  savedQueryControls?: React.ReactNode;
  facetPanel?: React.ReactNode;
  footer?: React.ReactNode;
  error?: React.ReactNode;
  status?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  hasResults?: boolean;
  resultsLabel?: string;
  resultsDescription?: React.ReactNode;
  placeholder?: string;
  queryInputId?: string;
  queryLabel?: string;
  queryAriaLabel?: string;
  queryControl?: React.ReactNode;
  searchButtonLabel?: string;
  clearButtonLabel?: string;
  searchButtonTestId?: string;
  clearButtonTestId?: string;
  loadingLabel?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  initialQuery?: string;
  loading?: boolean;
  disabled?: boolean;
  searchDisabled?: boolean;
  onClear?: () => void;
  className?: string;
}>;

/**
 * Builds a stable initial filter-value map from the declarative filter list.
 */
function buildInitialFilters(filters: readonly SearchFilterDef[]): Record<string, SearchFilterValue> {
  const values: Record<string, SearchFilterValue> = {};

  for (const filter of filters) {
    if (filter.type === "date-range") {
      values[filter.name] = {
        from: filter.defaultValue?.from ?? "",
        to: filter.defaultValue?.to ?? "",
      };
      continue;
    }

    values[filter.name] = filter.defaultValue ?? "";
  }

  return values;
}

/**
 * SearchPanel renders a shared query input, declarative filters, and results region.
 */
export function SearchPanel(props: SearchPanelProps) {
  const queryLabel = props.queryLabel ?? "Search";
  const queryAriaLabel = props.queryAriaLabel ?? (props.queryLabel ? props.queryLabel : "Search query");
  const searchButtonLabel = props.searchButtonLabel ?? "Search";
  const clearButtonLabel = props.clearButtonLabel ?? "Clear";
  const loadingLabel = props.loadingLabel ?? "Searching";
  const resultsLabel = props.resultsLabel ?? "Search results";
  const hasResults = props.hasResults ?? true;

  const [queryState, setQueryState] = React.useState(props.initialQuery ?? "");
  const [filterValues, setFilterValues] = React.useState<Record<string, SearchFilterValue>>(() =>
    buildInitialFilters(props.filters)
  );
  const query = props.query ?? queryState;

  React.useEffect(() => {
    setFilterValues(buildInitialFilters(props.filters));
  }, [props.filters]);

  const triggerSearch = React.useCallback(() => {
    if (props.disabled || props.searchDisabled) return;
    props.onSearch(query, filterValues);
  }, [filterValues, props, query]);

  const clearSearch = React.useCallback(() => {
    if (props.disabled) return;
    const cleared = buildInitialFilters(props.filters);
    const clearedQuery = props.initialQuery ?? "";
    setQueryState(clearedQuery);
    props.onQueryChange?.(clearedQuery);
    setFilterValues(cleared);
    props.onClear?.();
    props.onSearch(clearedQuery, cleared);
  }, [props]);

  const updateQuery = React.useCallback((value: string) => {
    setQueryState(value);
    props.onQueryChange?.(value);
  }, [props]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        triggerSearch();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearSearch();
      }
    },
    [clearSearch, triggerSearch]
  );

  const setStringFilter = React.useCallback((name: string, value: string) => {
    setFilterValues((current) => ({ ...current, [name]: value }));
  }, []);

  const setDateRangeFilter = React.useCallback((name: string, key: "from" | "to", value: string) => {
    setFilterValues((current) => {
      const existing = current[name];
      const next = typeof existing === "object" && existing !== null ? existing : { from: "", to: "" };
      return {
        ...current,
        [name]: {
          ...next,
          [key]: value,
        },
      };
    });
  }, []);

  return (
    <section
      className={cn("space-y-4 rounded-md border bg-background p-4", props.className)}
      aria-label="Search panel"
      onKeyDown={onKeyDown}
    >
      {props.title || props.description || props.headerActions ? (
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            {props.title ? <h2 className="text-lg font-semibold">{props.title}</h2> : null}
            {props.description ? <p className="text-sm text-muted-foreground">{props.description}</p> : null}
          </div>
          {props.headerActions ? <div className="flex flex-wrap items-center gap-2 lg:shrink-0">{props.headerActions}</div> : null}
        </header>
      ) : null}

      {props.scopeControls ? <div className="rounded-md border bg-card p-3">{props.scopeControls}</div> : null}

      {props.savedQueryControls ? <div>{props.savedQueryControls}</div> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={props.queryInputId ?? "cloud-dog-search-panel-query"}>
            {queryLabel}
          </label>
          {props.queryControl ?? (
            <Input
              id={props.queryInputId ?? "cloud-dog-search-panel-query"}
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={props.placeholder ?? "Search"}
              aria-label={queryAriaLabel}
              disabled={props.disabled}
            />
          )}
        </div>

        {props.filters.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {props.filters.map((filter) => {
              const value = filterValues[filter.name];

              if (filter.type === "select") {
                return (
                  <div key={filter.name} className="space-y-1">
                    <label className="text-sm font-medium" htmlFor={`search-filter-${filter.name}`}>
                      {filter.label}
                    </label>
                    <Select
                      id={`search-filter-${filter.name}`}
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => setStringFilter(filter.name, event.target.value)}
                      aria-label={filter.label}
                      disabled={props.disabled}
                    >
                      <option value="">{filter.placeholder ?? `All ${filter.label.toLowerCase()}`}</option>
                      {filter.options.map((option) => (
                        <option key={`${filter.name}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              }

              if (filter.type === "date-range") {
                const range = typeof value === "object" && value !== null ? value : { from: "", to: "" };
                return (
                  <fieldset key={filter.name} className="space-y-1">
                    <legend className="text-sm font-medium">{filter.label}</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        type="date"
                        value={range.from}
                        onChange={(event) => setDateRangeFilter(filter.name, "from", event.target.value)}
                        aria-label={`${filter.label} from`}
                        disabled={props.disabled}
                      />
                      <Input
                        type="date"
                        value={range.to}
                        onChange={(event) => setDateRangeFilter(filter.name, "to", event.target.value)}
                        aria-label={`${filter.label} to`}
                        disabled={props.disabled}
                      />
                    </div>
                  </fieldset>
                );
              }

              return (
                <div key={filter.name} className="space-y-1">
                  <label className="text-sm font-medium" htmlFor={`search-filter-${filter.name}`}>
                    {filter.label}
                  </label>
                  <Input
                    id={`search-filter-${filter.name}`}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setStringFilter(filter.name, event.target.value)}
                    placeholder={filter.placeholder ?? filter.label}
                    aria-label={filter.label}
                    disabled={props.disabled}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex gap-2 lg:shrink-0">
          <Button onClick={triggerSearch} loading={props.loading} disabled={props.disabled || props.searchDisabled} data-testid={props.searchButtonTestId}>
            {searchButtonLabel}
          </Button>
          <Button variant="secondary" onClick={clearSearch} disabled={props.disabled} data-testid={props.clearButtonTestId}>
            {clearButtonLabel}
          </Button>
        </div>
      </div>

      {props.error ? <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{props.error}</div> : null}

      {props.status ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">{props.status}</div> : null}

      <div className={cn("grid gap-4", props.facetPanel ? "lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]" : "")}>
        {props.facetPanel ? (
          <aside aria-label="Search facets" className="rounded-md border bg-card p-3">
            {props.facetPanel}
          </aside>
        ) : null}

        <section aria-label={resultsLabel} className="relative min-h-32 rounded-md border bg-muted/10">
          {props.resultsDescription ? <div className="border-b px-4 py-2 text-sm text-muted-foreground">{props.resultsDescription}</div> : null}
          {props.loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/75 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-5 w-5" />
                <span>{loadingLabel}</span>
              </div>
            </div>
          ) : null}

          <div className="min-h-32 p-4">
            {hasResults ? props.results : <p className="text-sm text-muted-foreground">{props.emptyMessage ?? "No matches found."}</p>}
          </div>
        </section>
      </div>

      {props.footer ? <footer className="text-sm text-muted-foreground">{props.footer}</footer> : null}
    </section>
  );
}
