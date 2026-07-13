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

// API Docs (PS-74): API reference, live MCP tool catalogue, live A2A skills, README.

import * as React from "react";
import {
  ApiDocsPanel,
  Badge,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  JsonBlock,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataColumn,
} from "@cloud-dog/ui";
import { PageHeader } from "../lib/ui";
import { useChartState } from "../state/AppState";

type McpTool = Readonly<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
type SkillRow = Readonly<{ name: string; description: string }>;

function normaliseTools(raw: unknown): McpTool[] {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = (data.tools ?? data.items ?? []) as unknown[];
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const schemaRaw = row.inputSchema ?? row.input_schema;
      return {
        name: String(row.name ?? "").trim(),
        description: String(row.description ?? ""),
        inputSchema: schemaRaw && typeof schemaRaw === "object" && !Array.isArray(schemaRaw) ? (schemaRaw as Record<string, unknown>) : undefined,
      };
    })
    .filter((t) => t.name);
}

const toolColumns: DataColumn<McpTool>[] = [
  { id: "name", header: "Tool Name", cell: (row) => <code className="text-sm">{row.name}</code>, sortable: true, sortValue: (row) => row.name },
  { id: "description", header: "Description", cell: (row) => row.description || "—" },
];

const skillColumns: DataColumn<SkillRow>[] = [
  { id: "name", header: "Skill", cell: (row) => <span className="font-mono text-sm">{row.name}</span>, sortable: true, sortValue: (row) => row.name },
  { id: "description", header: "Description", cell: (row) => row.description || "—" },
];

export function ApiDocsPage() {
  const { api, appVersion } = useChartState();
  const origin = window.location.origin;
  const toolsUrl = `${origin}/mcp/tools`;
  const agentCardUrl = `${origin}/.well-known/agent.json`;

  const [tools, setTools] = React.useState<McpTool[]>([]);
  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("api");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await api.mcpTools();
        if (!cancelled) setTools(normaliseTools(data));
      } catch { /* tab renders empty */ }
      try {
        const card = await api.a2aAgentCard();
        if (!cancelled) {
          setAgentCard(card);
          const raw = (card.skills ?? []) as Array<{ id?: string; name?: string; description?: string }>;
          setSkills(raw.map((s) => ({ name: String(s.id ?? s.name ?? "unknown"), description: String(s.description ?? "") })));
        }
      } catch { /* tab renders empty */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [api]);

  return (
    <div className="space-y-6">
      <PageHeader title="API Docs" version={appVersion} description="OpenAPI reference, MCP tool catalogue, and A2A skills (PS-74)." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP Tools ({loading ? "…" : tools.length})</TabsTrigger>
          <TabsTrigger value="a2a">A2A Skills ({loading ? "…" : skills.length})</TabsTrigger>
          <TabsTrigger value="readme">README</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <ApiDocsPanel
            openapiUrl="/api/openapi.json"
            links={[
              { label: "MCP tools", href: toolsUrl },
              { label: "A2A agent card", href: agentCardUrl },
              { label: "MCP Console", href: "/developer/mcp-console" },
              { label: "A2A Console", href: "/developer/a2a-console" },
            ]}
          />
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Registered MCP Tools ({tools.length})</h2>
              <p className="text-sm text-muted-foreground">Live from <code className="text-xs">{toolsUrl}</code>.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading…</div> : null}
              <DataTable columns={toolColumns} rows={tools} emptyMessage="No MCP tools." getRowId={(row) => row.name} tableId="chart-mcp-docs-tools" pageSize={25} columnPickerEnabled />
              {tools.map((tool) => (<JsonBlock key={tool.name} title={tool.name} value={tool} defaultCollapsed />))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="a2a">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">A2A Skills ({skills.length})</h2>
              <p className="text-sm text-muted-foreground">Live from <code className="text-xs">{agentCardUrl}</code>.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading…</div> : null}
              <DataTable columns={skillColumns} rows={skills} emptyMessage="No A2A skills." getRowId={(row) => row.name} tableId="chart-mcp-docs-skills" pageSize={20} />
              {agentCard ? <JsonBlock title="Agent card (full)" value={agentCard} defaultCollapsed /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readme">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">chart-mcp-server</h2>
              <Badge variant="secondary">v{appVersion}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Chart recommendation, validation, rendering, and governance across API, MCP, A2A and WebUI surfaces.</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li><strong>REST API</strong> under <code className="text-xs">/api</code>: profiles, sessions, recommend, validate, render, renders, assets, style-packs, renderers, recommendations, jobs.</li>
                <li><strong>MCP</strong> JSON-RPC at <code className="text-xs">/mcp</code> (tools/list, tools/call).</li>
                <li><strong>A2A</strong> agent card at <code className="text-xs">/.well-known/agent.json</code>, tasks at <code className="text-xs">/a2a/tasks</code>.</li>
                <li><strong>Auth</strong>: cookie session via <code className="text-xs">/auth/login</code>; the web tier bridges the session to an API key.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
