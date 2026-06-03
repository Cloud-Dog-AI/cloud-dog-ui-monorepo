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

// @cloud-dog/app-chat-client — MCP tool browser and execution page.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityForm,
  JsonExplorer,
  McpConsole,
  SearchPanel,
  Textarea,
} from "@cloud-dog/ui";
import type { DataColumn, EntityFieldDef, McpToolDef, SearchFilterDef, SearchFilterValues } from "@cloud-dog/ui";
import type { ToolDescriptor } from "../lib/types";
import { useAppState } from "../state/AppState";
import { isoNow } from "../lib/moment";

type ToolRow = Readonly<{
  id: string;
  serverIndex: number;
  serverName: string;
  tool: ToolDescriptor;
}>;

const executionFields: EntityFieldDef[] = [
  { name: "server", label: "Server", type: "text", readOnly: true },
  { name: "tool", label: "Tool", type: "text", readOnly: true },
  { name: "description", label: "Description", type: "text", readOnly: true },
];

function parseArgs(jsonText: string): Record<string, unknown> {
  const raw = jsonText.trim();
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function matchesSearch(row: ToolRow, query: string, filters: SearchFilterValues): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  const serverFilter = typeof filters.server === "string" ? filters.server : "";
  if (serverFilter && String(row.serverIndex) !== serverFilter) {
    return false;
  }
  if (!normalizedQuery) {
    return true;
  }
  const haystack = [row.tool.name, row.tool.description ?? "", row.serverName].join(" ").toLowerCase();
  return haystack.includes(normalizedQuery);
}

export function ToolsPage() {
  const {
    api,
    createSession,
    mcpServers,
    selectedServerIndices,
    addToolResult,
  } = useAppState();

  const [rows, setRows] = React.useState<ToolRow[]>([]);
  const [toolSessionId, setToolSessionId] = React.useState<string | null>(null);
  const [selectedTool, setSelectedTool] = React.useState<ToolRow | null>(null);
  const [argsText, setArgsText] = React.useState("{}");
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [isPreparingSession, setIsPreparingSession] = React.useState(false);
  const [isLoadingTools, setIsLoadingTools] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [searchState, setSearchState] = React.useState<{
    query: string;
    filters: SearchFilterValues;
  }>({
    query: "",
    filters: { server: "" },
  });

  React.useEffect(() => {
    if (toolSessionId || isPreparingSession) {
      return;
    }
    setIsPreparingSession(true);
    void createSession("Tool session")
      .then((sessionId) => {
        if (!sessionId) {
          throw new Error("Failed to create a session for tools");
        }
        setToolSessionId(sessionId);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to create a session for tools");
      })
      .finally(() => setIsPreparingSession(false));
  }, [createSession, isPreparingSession, toolSessionId]);

  const loadTools = React.useCallback(async () => {
    if (!toolSessionId || selectedServerIndices.length === 0) {
      setRows([]);
      setSelectedTool(null);
      setIsLoadingTools(false);
      return;
    }

    setError(null);
    setIsLoadingTools(true);
    try {
      const loaded: ToolRow[] = [];
      for (const serverIndex of selectedServerIndices) {
        try {
          const server = mcpServers.find((item) => item.index === serverIndex);
          const tools = await api.listTools(toolSessionId, serverIndex);
          for (const tool of tools) {
            loaded.push({
              id: `${serverIndex}:${tool.name}`,
              serverIndex,
              serverName: server?.name ?? `Server ${serverIndex}`,
              tool,
            });
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : `Failed to load tools for server ${serverIndex}`);
        }
      }

      setRows(loaded);
      setSelectedTool((current) => {
        if (!loaded.length) {
          return null;
        }
        if (!current) {
          return loaded[0];
        }
        return loaded.find((item) => item.id === current.id) ?? loaded[0];
      });
    } finally {
      setIsLoadingTools(false);
    }
  }, [api, mcpServers, selectedServerIndices, toolSessionId]);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const executeSelected = async (toolName: string, args: unknown) => {
    if (!selectedTool || !toolSessionId) {
      return {};
    }
    setError(null);
    try {
      const parsed = typeof args === "object" && args !== null && !Array.isArray(args)
        ? (args as Record<string, unknown>)
        : parseArgs(argsText);
      const execution = await api.callTool(toolSessionId, selectedTool.serverIndex, toolName, parsed);
      setResult(execution);
      setStatus(`Executed ${toolName}`);
      addToolResult({
        toolName,
        serverIndex: selectedTool.serverIndex,
        arguments: parsed,
        result: execution,
        timestamp: isoNow(),
      });
      return execution;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tool execution failed");
      throw err;
    }
  };

  const rowTools: McpToolDef[] = selectedTool ? [selectedTool.tool] : [];
  const searchFilters = React.useMemo<SearchFilterDef[]>(
    () => [
      {
        name: "server",
        label: "Server",
        type: "select",
        options: selectedServerIndices.map((serverIndex) => {
          const server = mcpServers.find((item) => item.index === serverIndex);
          return {
            label: server?.name ?? `Server ${serverIndex}`,
            value: String(serverIndex),
          };
        }),
        placeholder: "All servers",
      },
    ],
    [mcpServers, selectedServerIndices],
  );

  const filteredRows = React.useMemo(
    () => rows.filter((row) => matchesSearch(row, searchState.query, searchState.filters)),
    [rows, searchState.filters, searchState.query],
  );

  React.useEffect(() => {
    if (!filteredRows.length) {
      return;
    }
    if (!selectedTool || !filteredRows.some((row) => row.id === selectedTool.id)) {
      setSelectedTool(filteredRows[0]);
      setResult(null);
    }
  }, [filteredRows, selectedTool]);

  const columns = React.useMemo<DataColumn<ToolRow>[]>(
    () => [
      {
        id: "tool",
        header: "Tool",
        cell: (row) => (
          <Button
            type="button"
            className="text-left text-sky-700 hover:underline"
            onClick={() => {
              setSelectedTool(row);
              setResult(null);
            }}
          >
            {row.tool.name}
          </Button>
        ),
        sortable: true,
        sortValue: (row) => row.tool.name,
      },
      {
        id: "server",
        header: "Server",
        cell: (row) => row.serverName,
        sortable: true,
        sortValue: (row) => row.serverName,
      },
      {
        id: "description",
        header: "Description",
        cell: (row) => row.tool.description || "No description provided",
        sortable: true,
        sortValue: (row) => row.tool.description || "",
      },
      {
        id: "schema",
        header: "Input Schema",
        cell: (row) => (row.tool.inputSchema ? `${Object.keys(row.tool.inputSchema).length} field(s)` : "No schema"),
      },
    ],
    [],
  );

  const results = (
    <div className="space-y-3">
      {!toolSessionId ? (
        <p className="text-sm text-muted-foreground">
          {isPreparingSession ? "Preparing session..." : "No active session."}
        </p>
      ) : null}
      {selectedServerIndices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select at least one external service on the External Services page.</p>
      ) : null}
      {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">{filteredRows.length} tool(s) match the current search.</p>
      <DataTable
        columns={columns}
        rows={filteredRows}
        emptyMessage="No tools match the current filter."
        getRowId={(row) => row.id}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        columnPickerEnabled
        tableId="chat-client-tools"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Tools</h1>
          <p className="text-sm text-muted-foreground">
            Search the selected external service tools and open structured execution detail instead of raw JSON links.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => void loadTools()} loading={isLoadingTools}>
              Refresh tools
            </Button>
          </div>
          <SearchPanel
            placeholder="Search tools by name, description, or server"
            filters={searchFilters}
            loading={isLoadingTools}
            onSearch={(query, filters) => {
              setPage(1);
              setSearchState({ query, filters });
            }}
            results={results}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Execution detail</h2>
            <p className="text-sm text-muted-foreground">Shared read-only entity form for the selected tool.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedTool ? (
              <>
                <EntityForm
                  fields={executionFields}
                  values={{
                    server: `${selectedTool.serverIndex}: ${selectedTool.serverName}`,
                    tool: selectedTool.tool.name,
                    description: selectedTool.tool.description || "No description provided",
                  }}
                  mode="view"
                  onChange={() => {}}
                  onSubmit={() => {}}
                  onCancel={() => setSelectedTool(null)}
                />
                <div className="space-y-2">
                  <label htmlFor="tool-args" className="text-sm font-medium">Arguments (JSON object)</label>
                  <Textarea
                    id="tool-args"
                    value={argsText}
                    onChange={(event) => setArgsText(event.target.value)}
                    rows={10}
                    spellCheck={false}
                    className="font-mono text-xs"
                  />
                </div>
                <JsonExplorer
                  title="Input schema"
                  data={selectedTool.tool.inputSchema ?? {}}
                  defaultExpanded
                  maxDepth={6}
                />
                <Button onClick={() => void executeSelected(selectedTool.tool.name, argsText)}>
                  Try it
                </Button>
                {result !== null ? <JsonExplorer title="Result" data={result} defaultExpanded maxDepth={8} /> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a tool to inspect its schema and run it.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Shared MCP console</h2>
            <p className="text-sm text-muted-foreground">Execute the selected downstream tool through the shared console pattern.</p>
          </CardHeader>
          <CardContent>
            <McpConsole
              endpointUrl={selectedTool ? `${selectedTool.serverName} (${selectedTool.serverIndex})` : "Select a tool"}
              tools={rowTools}
              onExecute={(toolName, args) => executeSelected(toolName, args)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
