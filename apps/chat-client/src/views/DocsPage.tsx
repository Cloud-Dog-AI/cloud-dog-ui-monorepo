// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/app-chat-client — API documentation (PS-74 DW1–DW7).

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import {
  ApiDocsPanel,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DocumentViewer,
  Input,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataColumn,
} from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL: string;
  A2A_EVENTS_URL: string;
  API_KEY_HEADER?: string;
}>;

type McpToolRow = Readonly<{
  name: string;
  description: string;
  parameters: string;
  returnType: string;
}>;

type A2aSkillRow = Readonly<{
  id: string;
  name: string;
  description: string;
}>;

/** Resolve config paths (e.g. `/api/`) to an absolute origin URL for fetch and iframes. */
function resolveOriginUrl(cfgUrl: string): string {
  if (typeof window === "undefined") return cfgUrl.replace(/\/$/, "");
  try {
    return new URL(cfgUrl, window.location.origin).toString().replace(/\/$/, "");
  } catch {
    return cfgUrl.replace(/\/$/, "");
  }
}

/**
 * A2A agent card is served over HTTP at `/.well-known/agent.json` on the A2A service root.
 * `A2A_EVENTS_URL` is typically `/a2a/events` — the HTTP root for the card is `/a2a`.
 */
function resolveA2aHttpBaseForAgentCard(eventsUrl: string): string {
  if (typeof window === "undefined") return "/a2a";
  try {
    const absolute = new URL(eventsUrl, window.location.origin);
    const path = absolute.pathname.replace(/\/events\/?$/i, "") || "/a2a";
    return new URL(path, absolute.origin).toString().replace(/\/$/, "");
  } catch {
    return `${window.location.origin}/a2a`;
  }
}

export function DocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { apiKey, apiKeyHeader } = useAppState();
  const headerName = apiKeyHeader || cfg.API_KEY_HEADER || "X-API-Key";

  const [tab, setTab] = React.useState("api");
  const [docSearch, setDocSearch] = React.useState("");
  const [mcpTools, setMcpTools] = React.useState<McpToolRow[]>([]);
  const [mcpLoading, setMcpLoading] = React.useState(true);
  const [a2aSkills, setA2aSkills] = React.useState<A2aSkillRow[]>([]);
  const [a2aLoading, setA2aLoading] = React.useState(true);

  const webApiBase = resolveOriginUrl(cfg.API_BASE_URL);
  const openapiUrl = `${webApiBase}/openapi.json`;
  const mcpBase = resolveOriginUrl(cfg.MCP_BASE_URL);
  const a2aHttpBase = resolveA2aHttpBaseForAgentCard(cfg.A2A_EVENTS_URL);
  const agentCardUrl = `${a2aHttpBase}/.well-known/agent.json`;

  const rpcHeaders = React.useMemo(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey.trim()) headers[headerName] = apiKey.trim();
    return headers;
  }, [apiKey, headerName]);

  const optionalApiKeyHeaders = React.useMemo(() => {
    if (!apiKey.trim()) return undefined;
    return { [headerName]: apiKey.trim() } as Record<string, string>;
  }, [apiKey, headerName]);

  React.useEffect(() => {
    let cancelled = false;
    const loadMcp = async () => {
      setMcpLoading(true);
      const endpoint = mcpBase.replace(/\/$/, "");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: rpcHeaders,
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        });
        if (!response.ok) throw new Error(`MCP tools/list HTTP ${response.status}`);
        const payload = (await response.json()) as {
          result?: { tools?: Array<{ name?: string; description?: string; inputSchema?: unknown }> };
        };
        const list = payload.result?.tools ?? [];
        if (cancelled) return;
        setMcpTools(
          list.map((t) => ({
            name: String(t.name ?? ""),
            description: String(t.description ?? ""),
            parameters: t.inputSchema !== undefined ? JSON.stringify(t.inputSchema) : "{}",
            returnType: "MCP tool result (JSON-RPC content / structuredContent)",
          }))
        );
      } catch {
        try {
          const toolsUrl = new URL("tools", `${endpoint}/`).toString();
          const getHeaders: Record<string, string> = { Accept: "application/json" };
          if (apiKey.trim()) getHeaders[headerName] = apiKey.trim();
          const fallback = await fetch(toolsUrl, { credentials: "include", headers: getHeaders });
          if (!fallback.ok) throw new Error(`MCP tools HTTP ${fallback.status}`);
          const body = (await fallback.json()) as { tools?: Array<{ name?: string; description?: string; inputSchema?: unknown }> };
          const list = body.tools ?? [];
          if (cancelled) return;
          setMcpTools(
            list.map((t) => ({
              name: String(t.name ?? ""),
              description: String(t.description ?? ""),
              parameters: t.inputSchema !== undefined ? JSON.stringify(t.inputSchema) : "{}",
              returnType: "MCP tool result (JSON-RPC content / structuredContent)",
            }))
          );
        } catch {
          if (!cancelled) setMcpTools([]);
        }
      } finally {
        if (!cancelled) setMcpLoading(false);
      }
    };
    void loadMcp();
    return () => {
      cancelled = true;
    };
  }, [mcpBase, rpcHeaders]);

  React.useEffect(() => {
    let cancelled = false;
    const loadA2a = async () => {
      setA2aLoading(true);
      try {
        const response = await fetch(agentCardUrl, { credentials: "include", headers: optionalApiKeyHeaders });
        if (!response.ok) throw new Error(`A2A card HTTP ${response.status}`);
        const payload = (await response.json()) as { skills?: Array<{ id?: string; name?: string; description?: string }> };
        const skills = payload.skills ?? [];
        if (cancelled) return;
        setA2aSkills(
          skills.map((s) => ({
            id: String(s.id ?? ""),
            name: String(s.name ?? ""),
            description: String(s.description ?? ""),
          }))
        );
      } catch {
        if (!cancelled) setA2aSkills([]);
      } finally {
        if (!cancelled) setA2aLoading(false);
      }
    };
    void loadA2a();
    return () => {
      cancelled = true;
    };
  }, [agentCardUrl, optionalApiKeyHeaders]);

  const mcpColumns: DataColumn<McpToolRow>[] = [
    {
      id: "name",
      header: "Tool",
      cell: (row) => <code className="text-sm">{row.name}</code>,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description,
      sortable: true,
      sortValue: (row) => row.description,
    },
    {
      id: "parameters",
      header: "Parameters (input_schema)",
      cell: (row) => <span className="font-mono text-xs break-all">{row.parameters}</span>,
      sortable: false,
    },
    {
      id: "returnType",
      header: "Return type",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.returnType}</span>,
      sortable: false,
    },
  ];

  const skillColumns: DataColumn<A2aSkillRow>[] = [
    {
      id: "id",
      header: "Skill id",
      cell: (row) => <code className="text-sm">{row.id}</code>,
      sortable: true,
      sortValue: (row) => row.id,
    },
    {
      id: "name",
      header: "Name",
      cell: (row) => row.name,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description,
      sortable: true,
      sortValue: (row) => row.description,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">
          OpenAPI, live MCP tool catalogue, and A2A agent card skills for chat-client (PS-74).
        </p>
        <div className="grid gap-2 lg:grid-cols-[minmax(16rem,28rem)_1fr] lg:items-center">
          <Input
            aria-label="Search API docs"
            placeholder="Search API docs"
            value={docSearch}
            onChange={(event) => setDocSearch(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Authenticated session active. API key authorization, example request, response schema, MCP, and A2A references are available below.
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1" aria-label="Documentation sections">
          <TabsTrigger value="api">API reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP tools</TabsTrigger>
          <TabsTrigger value="a2a">A2A skills</TabsTrigger>
          <TabsTrigger value="readme">README</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <Card>
            <CardContent className="pt-6">
              <ApiDocsPanel
                mode="swagger"
                openapiUrl={openapiUrl}
                links={[
                  { label: "OpenAPI JSON", href: openapiUrl },
                  { label: "MCP health", href: `${mcpBase}/health` },
                  { label: "A2A agent card", href: agentCardUrl },
                  { label: "WebUI", href: "/ui" },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">MCP tools ({mcpTools.length})</h2>
              <p className="text-sm text-muted-foreground">
                Live catalogue from JSON-RPC <code className="text-xs">tools/list</code> (fallback <code className="text-xs">GET …/tools</code>).
              </p>
            </CardHeader>
            <CardContent>
              {mcpLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Loading tools…
                </div>
              ) : (
                <DataTable
                  tableId="chat-client-docs-mcp-tools"
                  columns={mcpColumns}
                  rows={mcpTools}
                  getRowId={(row) => row.name}
                  emptyMessage="No MCP tools returned. Check MCP health and API key."
                  pageSize={20}
                  columnPickerEnabled={false}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="a2a">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">A2A skills ({a2aSkills.length})</h2>
              <p className="text-sm text-muted-foreground">
                From <code className="text-xs">{agentCardUrl}</code> (HTTP root derived from <code className="text-xs">A2A_EVENTS_URL</code>).
              </p>
            </CardHeader>
            <CardContent>
              {a2aLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Loading skills…
                </div>
              ) : (
                <DataTable
                  tableId="chat-client-docs-a2a-skills"
                  columns={skillColumns}
                  rows={a2aSkills}
                  getRowId={(row) => row.id || row.name}
                  emptyMessage="No skills in agent card or A2A unreachable."
                  pageSize={20}
                  columnPickerEnabled={false}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readme">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Service documentation</h2>
            </CardHeader>
            <CardContent>
              <DocumentViewer
                content={`# Chat Client

Multi-model chat interface with session management, MCP proxy integration, and real-time streaming responses.`}
                format="auto"
                title="chat-client README"
                downloadFilename="chat-client-README.md"
                maxHeight="400px"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
