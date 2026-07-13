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

import * as React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, X } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  DataTable,
  Input,
  Select,
  Sheet,
  SearchPanel,
  Skeleton,
  Tooltip,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { JsonPanel } from "../components/JsonPanel";
import { exportRowsJson } from "../lib/exportRows";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { SearchExplain, SearchItem, SearchRelatedItem } from "../lib/types";

type SearchMode = "metadata" | "content";

type MatchedComponent = Readonly<{
  field: string;
  terms: string[];
}>;

type EntityFacet = Readonly<{
  namespace: string;
  entity: string;
  fields: string[];
}>;

const SEARCH_EXAMPLES = [
  { label: "Exact match", value: "customer@example.invalid" },
  { label: "Phrase", value: "\"quarterly renewal\"" },
  { label: "Field value", value: "email:customer@example.invalid" },
  { label: "Identifier", value: "order_id:1001" },
];

function toggleValue(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

function fieldKey(namespace: string, entity: string, field: string): string {
  return `${namespace}|${entity}|${field}`;
}

function fieldNameFromKey(key: string): string {
  return key.slice(key.lastIndexOf("|") + 1);
}

function extractFieldNames(fields: Array<Record<string, unknown>>): string[] {
  return fields
    .map((field) => field.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

export function SearchPage() {
  const { api, currentProfile } = useDbMcpState();
  const [mode, setMode] = React.useState<SearchMode>("metadata");
  const [query, setQuery] = React.useState("customer email");
  const [facets, setFacets] = React.useState<EntityFacet[]>([]);
  const [selectedNamespaces, setSelectedNamespaces] = React.useState<Set<string>>(new Set());
  const [selectedEntities, setSelectedEntities] = React.useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = React.useState<Set<string>>(new Set());
  const [facetsLoading, setFacetsLoading] = React.useState(false);
  const [examplesOpen, setExamplesOpen] = React.useState(false);
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [selectedExplain, setSelectedExplain] = React.useState<SearchExplain | null>(null);
  const [relatedResults, setRelatedResults] = React.useState<SearchRelatedItem[]>([]);
  const [selectedRelatedSource, setSelectedRelatedSource] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [relatedPage, setRelatedPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);

  const loadFacets = React.useCallback(async () => {
    if (!currentProfile) {
      setFacets([]);
      return;
    }
    setFacetsLoading(true);
    setError(null);
    try {
      const namespaceItems = currentProfile.namespaces.length
        ? currentProfile.namespaces.map((name) => ({ name }))
        : await api.listNamespaces(currentProfile.profile_id);
      const entityGroups = await Promise.all(
        namespaceItems.map(async (namespace) => {
          const entities = await api.listEntities(currentProfile.profile_id, namespace.name);
          return { namespace: namespace.name, entities };
        })
      );
      const nextFacets = await Promise.all(
        entityGroups.flatMap((group) =>
          group.entities.map(async (entity) => {
            const described = await api.describeFields(currentProfile.profile_id, group.namespace, entity.name);
            return {
              namespace: group.namespace,
              entity: entity.name,
              fields: extractFieldNames(described.fields),
            };
          })
        )
      );
      setFacets(nextFacets);
    } catch (facetError) {
      setError(facetError instanceof Error ? facetError.message : "Failed to load search facets.");
    } finally {
      setFacetsLoading(false);
    }
  }, [api, currentProfile]);

  const runSearch = async (searchQuery = query) => {
    if (!currentProfile) return;
    setError(null);
    setSearching(true);
    try {
      const items = mode === "metadata"
        ? await api.searchMetadata(currentProfile.profile_id, searchQuery, 10)
        : await api.searchContent(currentProfile.profile_id, searchQuery, 10);
      setPage(1);
      setResults(items);
      setSelectedExplain(null);
      setRelatedResults([]);
      setSelectedRelatedSource("");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Failed to search.");
    } finally {
      setSearching(false);
    }
  };

  const explain = async (item: SearchItem) => {
    if (!currentProfile) return;
    try {
      const detail = await api.explainMatch(currentProfile.profile_id, query, item.document_id);
      setSelectedExplain(detail);
    } catch (explainError) {
      setError(explainError instanceof Error ? explainError.message : "Failed to explain search result.");
    }
  };

  const findRelated = async (item: SearchItem) => {
    if (!currentProfile || !item.namespace || !item.entity) return;
    try {
      const related = await api.searchRelated(currentProfile.profile_id, item.namespace, item.entity, 10);
      setRelatedPage(1);
      setRelatedResults(related);
      setSelectedRelatedSource(`${item.namespace}.${item.entity}`);
    } catch (relatedError) {
      setError(relatedError instanceof Error ? relatedError.message : "Failed to find related entities.");
    }
  };

  React.useEffect(() => {
    if (!currentProfile) return;
    void runSearch();
    // initial page load only per profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.profile_id]);

  React.useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  const namespaceOptions = React.useMemo(
    () => Array.from(new Set(facets.map((facet) => facet.namespace))).sort(),
    [facets]
  );
  const entityOptions = React.useMemo(
    () => Array.from(new Set(facets.map((facet) => `${facet.namespace}.${facet.entity}`))).sort(),
    [facets]
  );
  const fieldOptions = React.useMemo(
    () =>
      facets.flatMap((facet) =>
        facet.fields.map((field) => ({
          key: fieldKey(facet.namespace, facet.entity, field),
          label: `${field} (${facet.namespace}.${facet.entity})`,
          name: field,
        }))
      ),
    [facets]
  );

  const filteredResults = React.useMemo(() => {
    const fieldNames = Array.from(selectedFields).map(fieldNameFromKey);
    return results.filter((item) => {
      if (selectedNamespaces.size > 0 && (!item.namespace || !selectedNamespaces.has(item.namespace))) return false;
      if (selectedEntities.size > 0 && (!item.namespace || !item.entity || !selectedEntities.has(`${item.namespace}.${item.entity}`))) return false;
      if (fieldNames.length > 0) {
        const searchable = `${item.title} ${item.excerpt ?? ""} ${item.doc_kind}`.toLowerCase();
        if (!fieldNames.some((field) => searchable.includes(field.toLowerCase()))) return false;
      }
      return true;
    });
  }, [results, selectedEntities, selectedFields, selectedNamespaces]);

  const clearFacets = () => {
    setSelectedNamespaces(new Set());
    setSelectedEntities(new Set());
    setSelectedFields(new Set());
  };

  const columns: DataColumn<SearchItem>[] = [
    {
      id: "title",
      header: "Title",
      // CX-103: first identifier column links to the entity detail view when the row carries namespace+entity.
      cell: (item) =>
        item.namespace && item.entity ? (
          <Link
            role="link"
            className="text-primary underline underline-offset-2 hover:no-underline"
            to={`/catalogue/${encodeURIComponent(currentProfile?.profile_id ?? "")}/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.entity)}`}
          >
            {item.title}
          </Link>
        ) : (
          item.title
        ),
      sortable: true,
      sortValue: (item) => item.title,
    },
    { id: "kind", header: "Kind", cell: (item) => item.doc_kind, sortable: true, sortValue: (item) => item.doc_kind },
    {
      id: "entity",
      header: "Entity",
      cell: (item) => (item.namespace && item.entity ? `${item.namespace}.${item.entity}` : "-"),
      sortable: true,
      sortValue: (item) => `${item.namespace ?? ""}.${item.entity ?? ""}`,
    },
    { id: "score", header: "Score", cell: (item) => String(item.score ?? "-"), sortable: true, sortValue: (item) => item.score ?? 0 },
    { id: "excerpt", header: "Excerpt", cell: (item) => item.excerpt ?? "-", sortable: true, sortValue: (item) => item.excerpt ?? "-" },
    createDataTableActionColumn<SearchItem>((item) => [
      { id: "explain", label: "Explain", onClick: () => void explain(item) },
      { id: "related", label: "Find Related", onClick: () => void findRelated(item), disabled: (row) => !row.namespace || !row.entity },
      ...(item.namespace && item.entity
        ? [
            {
              id: "open",
              label: "View entity",
              href: () => `/catalogue/${encodeURIComponent(currentProfile?.profile_id ?? "")}/${encodeURIComponent(item.namespace as string)}/${encodeURIComponent(item.entity as string)}`,
              title: () => `View ${item.namespace}.${item.entity}`,
            },
            {
              id: "audit",
              label: "Audit & Log",
              href: () =>
                `/audit-log?profile_id=${encodeURIComponent(currentProfile?.profile_id ?? "")}&namespace=${encodeURIComponent(item.namespace as string)}&entity=${encodeURIComponent(item.entity as string)}&document_id=${encodeURIComponent(item.document_id)}`,
              title: () => `Audit ${item.namespace}.${item.entity}`,
            },
          ]
        : []),
    ]),
  ];

  const matchedColumns: DataColumn<MatchedComponent>[] = [
    { id: "field", header: "Component", cell: (item) => item.field, sortable: true, sortValue: (item) => item.field },
    { id: "terms", header: "Matched terms", cell: (item) => item.terms.join(", "), sortable: true, sortValue: (item) => item.terms.join(", ") },
  ];

  const relatedColumns: DataColumn<SearchRelatedItem>[] = [
    {
      id: "namespace",
      header: "Namespace",
      // CX-103: first identifier column links to the related entity's detail view.
      cell: (item) => (
        <Link
          role="link"
          className="text-primary underline underline-offset-2 hover:no-underline"
          to={`/catalogue/${encodeURIComponent(currentProfile?.profile_id ?? "")}/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.entity)}`}
        >
          {item.namespace}
        </Link>
      ),
      sortable: true,
      sortValue: (item) => item.namespace,
    },
    { id: "entity", header: "Entity", cell: (item) => item.entity, sortable: true, sortValue: (item) => item.entity },
    { id: "score", header: "Score", cell: (item) => item.score, sortable: true, sortValue: (item) => item.score },
    { id: "reasons", header: "Reasons", cell: (item) => item.reasons.join("; "), sortable: true, sortValue: (item) => item.reasons.join("; ") },
    createDataTableActionColumn<SearchRelatedItem>((item) => [
      {
        id: "open",
        label: "View entity",
        href: () => `/catalogue/${encodeURIComponent(currentProfile?.profile_id ?? "")}/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.entity)}`,
        title: () => `View ${item.namespace}.${item.entity}`,
      },
      {
        id: "audit",
        label: "Audit & Log",
        href: () =>
          `/audit-log?profile_id=${encodeURIComponent(currentProfile?.profile_id ?? "")}&namespace=${encodeURIComponent(item.namespace)}&entity=${encodeURIComponent(item.entity)}`,
        title: () => `Audit ${item.namespace}.${item.entity}`,
      },
    ]),
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">Search across indexed schema, relationships, and content within the selected profile.</p>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <SearchPanel
        title="Search"
        description="Search across indexed schema, relationships, and content within the selected profile."
        query={query}
        onQueryChange={setQuery}
        queryInputId="search-query"
        queryLabel="Search query"
        placeholder="customer email"
        filters={[]}
        disabled={!currentProfile}
        loading={searching}
        loadingLabel="Searching"
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Tooltip content="Use exact values, quoted phrases, or backend-agnostic field:value terms.">
              <Button type="button" variant="ghost" size="sm" aria-label="Search query help">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Button type="button" variant="secondary" onClick={() => setExamplesOpen(true)}>
              Examples
            </Button>
          </div>
        }
        scopeControls={
          <div className="grid gap-4 md:grid-cols-[16rem_16rem] md:items-end">
            <ProfileSelect id="search-profile" />
            <div className="space-y-2">
              <label htmlFor="search-mode" className="text-sm font-medium">Mode</label>
              <Select id="search-mode" aria-label="Search mode" value={mode} onChange={(event) => setMode(event.target.value as SearchMode)}>
                <option value="metadata">Metadata</option>
                <option value="content">Content</option>
              </Select>
            </div>
          </div>
        }
        facetPanel={
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Facets</h2>
              <Button type="button" variant="secondary" size="sm" onClick={clearFacets}>Clear</Button>
            </div>
            {facetsLoading ? (
              <div className="space-y-2" role="status" aria-label="Search facets loading">
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
            ) : null}
            <section className="space-y-2" aria-label="Namespace facets">
              <h3 className="text-sm font-semibold">Namespace</h3>
              {namespaceOptions.length ? namespaceOptions.map((namespace) => (
                <label key={namespace} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedNamespaces.has(namespace)}
                    onChange={() => toggleValue(setSelectedNamespaces, namespace)}
                    aria-label={`Facet namespace ${namespace}`}
                  />
                  {namespace}
                </label>
              )) : <p className="text-sm text-muted-foreground">No namespaces loaded.</p>}
            </section>
            <section className="space-y-2" aria-label="Entity facets">
              <h3 className="text-sm font-semibold">Entity</h3>
              {entityOptions.length ? entityOptions.map((entity) => (
                <label key={entity} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedEntities.has(entity)}
                    onChange={() => toggleValue(setSelectedEntities, entity)}
                    aria-label={`Facet entity ${entity}`}
                  />
                  {entity}
                </label>
              )) : <p className="text-sm text-muted-foreground">No entities loaded.</p>}
            </section>
            <section className="space-y-2" aria-label="Field facets">
              <h3 className="text-sm font-semibold">Field</h3>
              {fieldOptions.length ? fieldOptions.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedFields.has(field.key)}
                    onChange={() => toggleValue(setSelectedFields, field.key)}
                    aria-label={`Facet field ${field.name} ${field.label}`}
                  />
                  {field.label}
                </label>
              )) : <p className="text-sm text-muted-foreground">No fields loaded.</p>}
            </section>
          </div>
        }
        resultsLabel="Search results"
        resultsDescription={`${filteredResults.length} ${filteredResults.length === 1 ? "match" : "matches"}`}
        onSearch={(searchQuery) => {
          setQuery(searchQuery);
          void runSearch(searchQuery);
        }}
        onClear={clearFacets}
        results={
          <DataTable
            ariaLabel="Search results"
            columns={columns}
            rows={filteredResults}
            emptyMessage="No matches found."
            page={page}
            pageSize={10}
            onPageChange={setPage}
            selectable
            bulkActions={[{ label: "Export selected", action: "export" }]}
            onBulkAction={(action, selectedIds) => {
              if (action === "export") {
                const selected = filteredResults.filter((item) => selectedIds.includes(item.document_id));
                exportRowsJson(selected, `search-results-${new Date().toISOString().slice(0, 10)}.json`);
              }
            }}
            columnPickerEnabled
            tableId="db-mcp-search-results"
            getRowId={(item) => item.document_id}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Matched components</h2></CardHeader>
          <CardContent className="space-y-4">
            <DataTable
              ariaLabel="Matched components"
              columns={matchedColumns}
              rows={(selectedExplain?.matched_components ?? []).map((c) => ({ field: c.field, terms: c.terms ?? [] }))}
              emptyMessage="Select a search result to inspect matched components."
              columnPickerEnabled
              tableId="db-mcp-search-explain-components"
              getRowId={(item) => `${item.field}:${item.terms.join(",")}`}
            />
            <JsonPanel title="Explain payload" value={selectedExplain ?? { note: "Select a result to inspect why it matched." }} testId="search-explain-json" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Related entities{selectedRelatedSource ? ` for ${selectedRelatedSource}` : ""}</h2></CardHeader>
          <CardContent>
            <DataTable
              ariaLabel="Related entities"
              columns={relatedColumns}
              rows={relatedResults}
              emptyMessage="Run “Find Related” on a search result to inspect similar entities."
              page={relatedPage}
              pageSize={10}
              onPageChange={setRelatedPage}
              selectable
              bulkActions={[{ label: "Export selected", action: "export" }]}
              onBulkAction={(action, selectedIds) => {
                if (action === "export") {
                  const selected = relatedResults.filter((item) => selectedIds.includes(`${item.namespace}.${item.entity}`));
                  exportRowsJson(selected, `related-entities-${new Date().toISOString().slice(0, 10)}.json`);
                }
              }}
              columnPickerEnabled
              tableId="db-mcp-search-related"
              getRowId={(item) => `${item.namespace}.${item.entity}`}
            />
          </CardContent>
        </Card>
      </div>

      <Sheet open={examplesOpen} onOpenChange={setExamplesOpen} side="right">
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Search examples</h2>
              <p className="text-sm text-muted-foreground">Backend-agnostic query patterns.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" aria-label="Close" onClick={() => setExamplesOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {SEARCH_EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className="block w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setQuery(example.value);
                  setExamplesOpen(false);
                }}
              >
                <span className="block font-medium">{example.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{example.value}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto border-t pt-3">
            <Button type="button" variant="secondary" onClick={() => setExamplesOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
