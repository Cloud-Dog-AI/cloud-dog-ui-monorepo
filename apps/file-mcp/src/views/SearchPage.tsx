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

// @cloud-dog/app-file-mcp — Search page.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  SearchPanel,
  type DataColumn,
  type SearchFilterDef,
  type SearchFilterValues,
} from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";

type SearchMode = "path" | "content" | "grep";

type SearchRow = Readonly<{
  id: string;
  path: string;
  lineNo: number | null;
  preview: string;
}>;

function isInternalSearchArtifact(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/logs/snapshots/") || normalized.endsWith(".lock");
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return ".";
  return path.slice(0, idx);
}

function unwrapAnchoredRegex(query: string): string {
  const trimmed = query.trim();
  if (!trimmed.startsWith("^") || !trimmed.endsWith("$")) return "";
  return trimmed.slice(1, -1).trim();
}

function normalizeScopedSearchPath(path: string, scopeRoot?: string): string {
  const normalizedPath = path.replace(/\\/g, "/").trim();
  const normalizedRoot = (scopeRoot ?? "").replace(/\\/g, "/").trim();
  if (!normalizedPath || !normalizedRoot) return normalizedPath;
  if (normalizedRoot.startsWith("/")) return normalizedPath;
  const rootSegments = normalizedRoot.split("/").filter((segment) => segment && segment !== ".");
  const pathSegments = normalizedPath.split("/").filter((segment) => segment && segment !== ".");
  if (!rootSegments.length || pathSegments.length < rootSegments.length) return normalizedPath;

  for (let index = 0; index <= pathSegments.length - rootSegments.length; index += 1) {
    const matches = rootSegments.every((segment, offset) => pathSegments[index + offset] === segment);
    if (!matches) continue;
    const remainder = pathSegments.slice(index + rootSegments.length).join("/");
    return remainder || ".";
  }

  return normalizedPath;
}

export function SearchPage() {
  const navigate = useNavigate();
  const { api, availableProfiles, selectedProfile, setSelectedProfile } = useFileMcpState();

  const [mode, setMode] = React.useState<SearchMode>("content");
  const [rows, setRows] = React.useState<SearchRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const searchFilters = React.useMemo<SearchFilterDef[]>(
    () => [
      {
        name: "profile",
        label: "Storage profile",
        type: "select",
        defaultValue: selectedProfile,
        options: (availableProfiles.length
          ? availableProfiles
          : [{ name: "default", backend: "local" }]).map((profile) => ({
          label: `${profile.name} (${profile.backend})`,
          value: profile.name,
        })),
      },
      {
        name: "mode",
        label: "Search type",
        type: "select",
        defaultValue: mode,
        options: [
          { label: "Filename", value: "path" },
          { label: "Content", value: "content" },
          { label: "Grep (regex)", value: "grep" },
        ],
      },
    ],
    [availableProfiles, mode, selectedProfile]
  );

  const runSearch = async (queryText: string, filters: SearchFilterValues) => {
    const q = queryText.trim();
    if (!q) return;

    const nextProfile =
      typeof filters.profile === "string" && filters.profile.trim() ? filters.profile.trim() : selectedProfile;
    const nextMode = (
      typeof filters.mode === "string" && filters.mode.trim() ? filters.mode.trim() : mode
    ) as SearchMode;

    if (nextProfile !== selectedProfile) {
      setSelectedProfile(nextProfile);
    }
    if (nextMode !== mode) {
      setMode(nextMode);
    }

    const nextProfileMeta = availableProfiles.find((profile) => profile.name === nextProfile) ?? null;
    const nextScopeRoot = nextProfileMeta?.roots?.[0] ?? "";

    setIsLoading(true);
    setError(null);

    try {
      if (nextMode === "path") {
        const results = await api.searchPaths(q);
        const visibleResults = results
          .filter((item) => !isInternalSearchArtifact(item.path))
          .sort((left, right) => left.path.localeCompare(right.path));
        setRows(
          visibleResults.map((item, index) => ({
            id: `${item.path}-${index}`,
            path: normalizeScopedSearchPath(item.path, nextScopeRoot),
            lineNo: null,
            preview: item.path,
          }))
        );
      } else {
        let results = await api.searchContent(q, nextMode === "grep");
        if (nextMode === "grep" && results.length === 0) {
          const fallback = unwrapAnchoredRegex(q);
          if (fallback) {
            results = await api.searchContent(fallback, false);
          }
        }
        const visibleResults = results
          .filter((item) => !isInternalSearchArtifact(item.path))
          .sort((left, right) => left.path.localeCompare(right.path));
        setRows(
          visibleResults.map((item, index) => ({
            id: `${item.path}:${item.line_no}:${index}`,
            path: normalizeScopedSearchPath(item.path, nextScopeRoot),
            lineNo: Number.isFinite(item.line_no) ? item.line_no : null,
            preview: item.line,
          }))
        );
      }
      setPage(1);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search request failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const columns: DataColumn<SearchRow>[] = [
    {
      id: "path",
      header: "Path",
      cell: (row) => <span className="font-mono text-xs break-all">{row.path}</span>,
      sortable: true,
      sortValue: (row) => row.path,
    },
    {
      id: "line",
      header: "Line",
      cell: (row) => (row.lineNo ? String(row.lineNo) : "-"),
      sortable: true,
      sortValue: (row) => row.lineNo ?? 0,
    },
    {
      id: "preview",
      header: "Preview",
      cell: (row) => <span className="font-mono text-xs whitespace-pre-wrap">{row.preview}</span>,
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            navigate(`/file-browser?path=${encodeURIComponent(dirname(row.path))}&file=${encodeURIComponent(row.path)}`)
          }
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search scoped storage content with the governed search panel and open matching results in File Browser.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <SearchPanel
        filters={searchFilters}
        placeholder="Enter filename, content, or regex"
        loading={isLoading}
        onSearch={(searchText, filters) => {
          void runSearch(searchText, filters);
        }}
        results={
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Results</h2>
            </CardHeader>
            <CardContent>
              <DataTable
                tableId="file-mcp-search-results"
                columns={columns}
                rows={rows}
                totalRows={rows.length}
                getRowId={(row) => row.id}
                emptyMessage="No matching files were found."
                selectable={true}
                page={page}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                columnPickerEnabled={true}
              />
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
