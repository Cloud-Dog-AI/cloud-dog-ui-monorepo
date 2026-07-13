// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// PS-74 Docs Page — db-mcp: authenticated MCP/A2A discovery (PC15).

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import {
  ApiDocsPanel,
  Badge,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DocumentViewer,
  JsonBlock,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  WorkedExamplePopup,
  type DataColumn,
} from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  A2A_BASE_URL?: string;
  API_KEY_HEADER?: string;
}>;

type McpTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

type SkillRow = Readonly<{ name: string; description: string }>;

// DM-AD-04: README markdown rendered directly by the README tab's DocumentViewer.
// Hoisted to a module const so the README tab no longer nests a second ApiDocsPanel
// (which collided on the default "api-docs" testId prefix and resolved to the
// api-tab panel that has no readmeContent, showing the "not available" fallback).
const README_MD =
  "# db-mcp-server\n\nDatabase discovery, governance and MCP tooling.\n\n- **API surface:** REST under `/api/v1` (see the API Reference tab and Swagger UI).\n- **MCP surface:** tools listed under `/webmcp/tools` (see the MCP Reference tab and MCP Console).\n- **A2A surface:** skills on the agent card (see the A2A Reference tab and A2A Console).\n\nUse the API Reference, MCP Reference, and A2A Reference tabs for live interface documentation.";

function resolveServiceOrigin(apiBaseUrl: string): string {
  const cleaned = apiBaseUrl.replace(/\/+$/, "");
  if (cleaned.endsWith("/api")) {
    return cleaned.slice(0, -4) || (typeof window !== "undefined" ? window.location.origin : "");
  }
  return cleaned || (typeof window !== "undefined" ? window.location.origin : "");
}

function resolveA2aBase(a2aBaseUrl: string): string {
  if (typeof window === "undefined") return a2aBaseUrl.replace(/\/$/, "");
  try {
    const parsed = new URL(a2aBaseUrl, window.location.origin);
    if (parsed.origin === window.location.origin && !parsed.pathname.includes("/weba2a")) {
      return `${window.location.origin}/weba2a`;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return a2aBaseUrl.replace(/\/$/, "");
  }
}

function normaliseMcpTools(raw: unknown): McpTool[] {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = (data.tools ?? data.items ?? data.data ?? []) as unknown[];
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const schemaRaw = row.inputSchema ?? row.input_schema;
      const schema =
        schemaRaw && typeof schemaRaw === "object" && !Array.isArray(schemaRaw)
          ? (schemaRaw as Record<string, unknown>)
          : undefined;
      return {
        name: String(row.name ?? "").trim(),
        description: String(row.description ?? ""),
        inputSchema: schema,
      };
    })
    .filter((t) => t.name);
}

// W28E-610 CX-150: tool name opens the shared WorkedExamplePopup.
const makeToolColumns = (onExample: (row: McpTool) => void): DataColumn<McpTool>[] => [
  { id: "name", header: "Tool Name", cell: (row) => (
      <button type="button" className="text-primary underline underline-offset-2 hover:no-underline" onClick={() => onExample(row)}>
        <code className="text-sm">{row.name}</code>
      </button>
    ), sortable: true, sortValue: (row) => row.name },
  { id: "description", header: "Description", cell: (row) => row.description || "\u2014" },
  {
    id: "params",
    header: "Parameters",
    cell: (row) => {
      const props = row.inputSchema?.properties;
      if (!props || typeof props !== "object") return "\u2014";
      const required = new Set((row.inputSchema?.required ?? []) as string[]);
      return Object.keys(props as Record<string, unknown>).map((k) => (required.has(k) ? `${k}*` : k)).join(", ");
    },
  },
  {
    id: "category",
    header: "Category",
    cell: (row) => {
      const name = row.name;
      if (name.startsWith("catalog.")) return <Badge variant="secondary">Catalog</Badge>;
      if (name.startsWith("schema.")) return <Badge variant="secondary">Schema</Badge>;
      if (name.startsWith("data.")) return <Badge variant="secondary">Data</Badge>;
      if (name.startsWith("search.") || name.startsWith("index.")) return <Badge variant="secondary">Search</Badge>;
      if (name.startsWith("relationship.")) return <Badge variant="secondary">Relationship</Badge>;
      if (
        name.includes("admin") ||
        name.startsWith("users.") ||
        name.startsWith("groups.") ||
        name.startsWith("api_keys.") ||
        name.startsWith("profiles.")
      )
        return <Badge variant="secondary">Admin</Badge>;
      if (name.startsWith("audit.")) return <Badge variant="secondary">Audit</Badge>;
      return <Badge variant="secondary">Other</Badge>;
    },
    sortable: true,
    sortValue: (row) => row.name.split(".")[0],
  },
];

// W28E-610 CX-150: skill name opens the shared WorkedExamplePopup.
const makeSkillColumns = (onExample: (row: SkillRow) => void): DataColumn<SkillRow>[] => [
  {
    id: "name",
    header: "Skill",
    cell: (row) => (
      <button type="button" className="text-primary underline underline-offset-2 hover:no-underline font-mono text-sm" onClick={() => onExample(row)}>
        {row.name}
      </button>
    ),
    sortable: true,
    sortValue: (row) => row.name,
  },
  {
    id: "description",
    header: "Description",
    cell: (row) => row.description || "\u2014",
    sortable: true,
    sortValue: (row) => row.description,
  },
];

export function ApiDocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { apiKey } = useDbMcpState();
  const headerName = cfg.API_KEY_HEADER ?? "X-API-Key";
  const baseOrigin = resolveServiceOrigin(cfg.API_BASE_URL);
  const a2aBase = resolveA2aBase(cfg.A2A_BASE_URL ?? cfg.API_BASE_URL);
  const agentCardUrl = `${a2aBase}/.well-known/agent.json`;

  const [tools, setTools] = React.useState<McpTool[]>([]);
  const [toolError, setToolError] = React.useState<string | null>(null);
  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [a2aError, setA2aError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("api");
  // W28E-610 CX-150: shared WorkedExamplePopup opened from a tool/skill name.
  const [examplePopup, setExamplePopup] = React.useState<{ kind: "tool"; data: McpTool } | { kind: "skill"; data: SkillRow } | null>(null);
  const toolColumns = React.useMemo(() => makeToolColumns((row) => setExamplePopup({ kind: "tool", data: row })), []);
  const skillColumns = React.useMemo(() => makeSkillColumns((row) => setExamplePopup({ kind: "skill", data: row })), []);

  const authFetchInit = React.useMemo((): RequestInit => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey.trim()) headers[headerName] = apiKey.trim();
    return { credentials: "include", headers };
  }, [apiKey, headerName]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setToolError(null);
    setA2aError(null);

    void (async () => {
      try {
        const toolsResp = await fetch(`${baseOrigin}/webmcp/tools`, authFetchInit);
        if (!toolsResp.ok) {
          const text = await toolsResp.text();
          if (!cancelled) {
            setToolError(`MCP tools HTTP ${toolsResp.status}: ${text.slice(0, 200)}`);
            setTools([]);
          }
        } else {
          const json = await toolsResp.json();
          if (!cancelled) setTools(normaliseMcpTools(json));
        }
      } catch (e) {
        if (!cancelled) setToolError(e instanceof Error ? e.message : "Failed to load MCP tools");
      }

      try {
        const cardResp = await fetch(agentCardUrl, authFetchInit);
        if (!cardResp.ok) {
          if (!cancelled) {
            setAgentCard(null);
            setSkills([]);
            setA2aError(`Agent card HTTP ${cardResp.status}`);
          }
        } else {
          const card = (await cardResp.json()) as Record<string, unknown>;
          if (cancelled) return;
          setAgentCard(card);
          const cardSkills = (card.skills ?? []) as Array<{ id?: string; name?: string; description?: string }>;
          setSkills(
            cardSkills.map((s) => ({
              name: String(s.id ?? s.name ?? "unknown"),
              description: String(s.description ?? ""),
            })),
          );
          setA2aError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setAgentCard(null);
          setSkills([]);
          setA2aError(e instanceof Error ? e.message : "Failed to load agent card");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentCardUrl, authFetchInit, baseOrigin]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">OpenAPI, MCP tool catalogue, and A2A skills for db-mcp (PS-74).</p>
      </header>

      <div className="flex items-center gap-3">
        <input type="text" placeholder="Search docs..." className="w-64 rounded border px-3 py-1.5 text-sm" aria-label="Search" />
        <Badge variant="secondary">Authenticated</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP Tools / MCP Reference ({loading ? "\u2026" : tools.length})</TabsTrigger>
          <TabsTrigger value="a2a">A2A Reference ({loading ? "\u2026" : skills.length})</TabsTrigger>
          <TabsTrigger value="readme">README</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <ApiDocsPanel
            openapiUrl="/api/openapi.json"
            links={[
              { label: "Swagger UI", href: "/api/docs" },
              { label: "MCP tools", href: `${baseOrigin}/webmcp/tools` },
              { label: "A2A health", href: `${baseOrigin}/weba2a/health` },
              { label: "MCP Console", href: "/developer/mcp-console" },
              { label: "A2A Console", href: "/developer/a2a-console" },
            ]}
          />
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Registered MCP Tools ({tools.length})</h2>
              <p className="text-sm text-muted-foreground">Parameters marked with * are required. Categories derived from tool name prefix.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Loading tools…
                </div>
              ) : null}
              {toolError ? <p className="text-sm text-destructive" role="alert">{toolError}</p> : null}
              <DataTable
                columns={toolColumns}
                rows={tools}
                emptyMessage="No MCP tools registered."
                getRowId={(row) => row.name}
                tableId="db-mcp-tools"
                columnPickerEnabled
                pageSize={25}
              />
              {tools.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Tool schemas — select from the table above to inspect</h3>
                  <p className="text-xs text-muted-foreground">Click any row to copy the tool name. Schemas are shown collapsed below — expand to inspect parameters and input schema.</p>
                  {tools.map((tool) => (
                    <JsonBlock key={tool.name} title={tool.name} value={tool} defaultCollapsed />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="a2a">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">A2A Skills ({skills.length})</h2>
              <p className="text-sm text-muted-foreground">
                Live data from <code className="text-xs">{agentCardUrl}</code>. See the{" "}
                <a href="/developer/a2a-console" className="text-primary underline">
                  A2A Console
                </a>{" "}
                for testing.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Loading agent card…
                </div>
              ) : null}
              {a2aError ? <p className="text-sm text-muted-foreground" role="status">{a2aError}</p> : null}
              {skills.length > 0 ? (
                <DataTable
                  tableId="db-mcp-api-docs-a2a-skills"
                  columns={skillColumns}
                  rows={skills}
                  getRowId={(row) => row.name}
                  emptyMessage="No skills on agent card."
                  pageSize={20}
                  columnPickerEnabled={false}
                />
              ) : !loading && !a2aError ? (
                <p className="text-sm text-muted-foreground">No A2A skills on the agent card.</p>
              ) : null}
              {agentCard ? <JsonBlock title="Agent card (full)" value={agentCard} defaultCollapsed /> : null}
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="text-sm font-semibold">A2A usage guide</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li><strong>Endpoint:</strong> POST to <code className="text-xs">{a2aBase}/weba2a/tasks/send</code> with a JSON-RPC 2.0 message</li>
                  <li><strong>Topics:</strong> Use <code className="text-xs">root</code> for service info, <code className="text-xs">health</code> for health check</li>
                  <li><strong>Skills</strong> are listed in the agent card above. Each skill accepts a message payload.</li>
                  <li><strong>Authentication:</strong> Include <code className="text-xs">{cfg.API_KEY_HEADER ?? "X-API-Key"}</code> header or browser session cookie</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Database Safety Guide</h2>
              <p className="text-sm text-muted-foreground">Security and access control rules for database operations</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Read-only by default:</strong> Non-admin users have read-only access</li>
                <li><strong>Destructive operations:</strong> DROP, TRUNCATE, DELETE without WHERE require admin role</li>
                <li><strong>Query timeout:</strong> Configurable per-profile via defaults.yaml</li>
                <li><strong>Max result rows:</strong> Default 1000, configurable per-profile</li>
                <li><strong>Audit:</strong> Bind parameters are redacted in audit logs</li>
              </ul>
              <JsonBlock
                title="Raw Safety Configuration"
                value={{
                  read_only_by_default: "Non-admin users have read-only access",
                  destructive_ops_admin_only: "DROP, TRUNCATE, DELETE without WHERE require admin role",
                  query_timeout: "Configurable per-profile via defaults.yaml",
                  max_result_rows: "Default 1000, configurable per-profile",
                  bind_parameters_redacted: "Bind params are redacted in audit logs",
                }}
                defaultCollapsed={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readme">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">README</h2>
              <p className="text-sm text-muted-foreground">Service README — db-mcp-server.</p>
            </CardHeader>
            <CardContent>
              {/* DM-AD-04: render the README directly. Previously nested a second
                  ApiDocsPanel here, which (a) collided on the default "api-docs"
                  testId prefix with the api-tab panel and (b) defaulted its own
                  inner tab to "api" so the README was never shown by default —
                  the visible DocumentViewer resolved to the panel lacking
                  readmeContent, hence "README content is not available". */}
              <DocumentViewer content={README_MD} format="markdown" title="db-mcp-server" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {examplePopup ? (
        examplePopup.kind === "tool" ? (
          <WorkedExamplePopup
            open={true}
            onOpenChange={(open) => !open && setExamplePopup(null)}
            title={`MCP tool — ${examplePopup.data.name}`}
            description={examplePopup.data.description}
            exampleInput={{ name: examplePopup.data.name, arguments: {} }}
            exampleOutput={{ result: "<tool output>" }}
            endpointUrl={`${baseOrigin}/webmcp/tools/${examplePopup.data.name}`}
            method="POST"
            headers={{ "Content-Type": "application/json" }}
          />
        ) : (
          <WorkedExamplePopup
            open={true}
            onOpenChange={(open) => !open && setExamplePopup(null)}
            title={`A2A skill — ${examplePopup.data.name}`}
            description={examplePopup.data.description}
            exampleInput={{ skill: examplePopup.data.name, parameters: {} }}
            exampleOutput={{ status: "completed", result: "<skill output>" }}
            endpointUrl={`${a2aBase}/weba2a/tasks/send`}
            method="POST"
            headers={{ "Content-Type": "application/json" }}
          />
        )
      ) : null}
    </div>
  );
}
