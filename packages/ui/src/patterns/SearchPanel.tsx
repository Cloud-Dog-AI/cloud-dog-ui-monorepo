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
  placeholder?: string;
  queryInputId?: string;
  queryLabel?: string;
  queryAriaLabel?: string;
  loading?: boolean;
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

  const [query, setQuery] = React.useState("");
  const [filterValues, setFilterValues] = React.useState<Record<string, SearchFilterValue>>(() =>
    buildInitialFilters(props.filters)
  );

  React.useEffect(() => {
    setFilterValues(buildInitialFilters(props.filters));
  }, [props.filters]);

  const triggerSearch = React.useCallback(() => {
    props.onSearch(query, filterValues);
  }, [filterValues, props, query]);

  const clearSearch = React.useCallback(() => {
    const cleared = buildInitialFilters(props.filters);
    setQuery("");
    setFilterValues(cleared);
    props.onSearch("", cleared);
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={props.queryInputId ?? "cloud-dog-search-panel-query"}>
            {queryLabel}
          </label>
          <Input
            id={props.queryInputId ?? "cloud-dog-search-panel-query"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={props.placeholder ?? "Search"}
            aria-label={queryAriaLabel}
          />
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
                      />
                      <Input
                        type="date"
                        value={range.to}
                        onChange={(event) => setDateRangeFilter(filter.name, "to", event.target.value)}
                        aria-label={`${filter.label} to`}
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
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex gap-2 lg:shrink-0">
          <Button onClick={triggerSearch} loading={props.loading}>
            Search
          </Button>
          <Button variant="secondary" onClick={clearSearch}>
            Clear
          </Button>
        </div>
      </div>

      <div className="relative min-h-32 rounded-md border bg-muted/10">
        {props.loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/75 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-5 w-5" />
              <span>Searching</span>
            </div>
          </div>
        ) : null}

        <div className="min-h-32 p-4">{props.results}</div>
      </div>
    </section>
  );
}
