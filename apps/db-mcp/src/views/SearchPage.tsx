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
import { Button, Card, CardContent, CardHeader, DataTable, Input, Select, type DataColumn } from "@cloud-dog/ui";
import { JsonPanel } from "../components/JsonPanel";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { SearchExplain, SearchItem, SearchRelatedItem } from "../lib/types";

type SearchMode = "metadata" | "content";

type MatchedComponent = Readonly<{
  field: string;
  terms: string[];
}>;

export function SearchPage() {
  const { api, currentProfile } = useDbMcpState();
  const [mode, setMode] = React.useState<SearchMode>("metadata");
  const [query, setQuery] = React.useState("customer email");
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [selectedExplain, setSelectedExplain] = React.useState<SearchExplain | null>(null);
  const [relatedResults, setRelatedResults] = React.useState<SearchRelatedItem[]>([]);
  const [selectedRelatedSource, setSelectedRelatedSource] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const [relatedPage, setRelatedPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);

  const runSearch = async () => {
    if (!currentProfile) return;
    setError(null);
    setSearching(true);
    try {
      const items = mode === "metadata"
        ? await api.searchMetadata(currentProfile.profile_id, query, 10)
        : await api.searchContent(currentProfile.profile_id, query, 10);
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

  const columns: DataColumn<SearchItem>[] = [
    { id: "title", header: "Title", cell: (item) => item.title, sortable: true, sortValue: (item) => item.title },
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
    {
      id: "action",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void explain(item)}>Explain</Button>
          <Button size="sm" onClick={() => void findRelated(item)} disabled={!item.namespace || !item.entity}>Find Related</Button>
          {item.namespace && item.entity ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/catalogue/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.entity)}`}>Open entity</Link>
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const matchedColumns: DataColumn<MatchedComponent>[] = [
    { id: "field", header: "Component", cell: (item) => item.field, sortable: true, sortValue: (item) => item.field },
    { id: "terms", header: "Matched terms", cell: (item) => item.terms.join(", "), sortable: true, sortValue: (item) => item.terms.join(", ") },
  ];

  const relatedColumns: DataColumn<SearchRelatedItem>[] = [
    { id: "namespace", header: "Namespace", cell: (item) => item.namespace, sortable: true, sortValue: (item) => item.namespace },
    { id: "entity", header: "Entity", cell: (item) => item.entity, sortable: true, sortValue: (item) => item.entity },
    { id: "score", header: "Score", cell: (item) => item.score, sortable: true, sortValue: (item) => item.score },
    { id: "reasons", header: "Reasons", cell: (item) => item.reasons.join("; "), sortable: true, sortValue: (item) => item.reasons.join("; ") },
    {
      id: "action",
      header: "Actions",
      cell: (item) => (
        <Button asChild size="sm" variant="secondary">
          <Link to={`/catalogue/${encodeURIComponent(item.namespace)}/${encodeURIComponent(item.entity)}`}>Open entity</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">Search across indexed schema, relationships, and content within the selected profile.</p>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Search query</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[16rem_1fr_auto] md:items-end">
          <ProfileSelect id="search-profile" />
          <Input aria-label="Search query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a search term, entity name, or field value (e.g. 'customer email')" />
          <div className="flex gap-2">
            <Select aria-label="Search mode" value={mode} onChange={(event) => setMode(event.target.value as SearchMode)}>
              <option value="metadata">Metadata</option>
              <option value="content">Content</option>
            </Select>
            <Button onClick={() => void runSearch()} disabled={searching} data-testid="search-run-button">{searching ? "Searching..." : "Search"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Results</h2></CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={results}
            emptyMessage="No matches found."
            page={page}
            pageSize={10}
            onPageChange={setPage}
            selectable
            bulkActions={[{ label: "Export selected", action: "export" }]}
            onBulkAction={(action, selectedIds) => {
              if (action === "export") {
                const selected = results.filter((item) => selectedIds.includes(item.document_id));
                const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `search-results-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
            columnPickerEnabled
            tableId="db-mcp-search-results"
            getRowId={(item) => item.document_id}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Matched components</h2></CardHeader>
          <CardContent className="space-y-4">
            <DataTable
              columns={matchedColumns}
              rows={(selectedExplain?.matched_components ?? []).map((c) => ({ field: c.field, terms: c.terms ?? [] }))}
              emptyMessage="Select a search result to inspect matched components."
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
              columns={relatedColumns}
              rows={relatedResults}
              emptyMessage="Run “Find Related” on a search result to inspect similar entities."
              page={relatedPage}
              pageSize={10}
              onPageChange={setRelatedPage}
              selectable
              columnPickerEnabled
              tableId="db-mcp-search-related"
              getRowId={(item) => `${item.namespace}.${item.entity}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
