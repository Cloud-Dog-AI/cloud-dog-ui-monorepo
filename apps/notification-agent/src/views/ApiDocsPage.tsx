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

// @cloud-dog/app-notification-agent — API documentation page (PS-74 DW1-DW7).

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
  JsonBlock,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataColumn,
} from "@cloud-dog/ui";
import { useNotificationAgentState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
}>;

type ToolRow = Readonly<{ name: string; description: string; parameters: string; returnType: string }>;
type SkillRow = Readonly<{ name: string; description: string }>;

export function ApiDocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api } = useNotificationAgentState();
  const mcpBase = cfg.MCP_BASE_URL ?? `${window.location.origin}/mcp`;
  const a2aBase = cfg.A2A_BASE_URL ?? `${window.location.origin}/a2a`;

  const [tab, setTab] = React.useState("api");
  const [tools, setTools] = React.useState<ToolRow[]>([]);
  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void Promise.all([
      api
        .listMcpTools()
        .then((list) => {
          setTools(list.map((t) => {
            const schema = t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema as { properties?: Record<string, unknown> } : {};
            const props = schema.properties ?? {};
            return { name: t.name, description: t.description ?? "", parameters: Object.keys(props).join(", ") || "none", returnType: "object" };
          }));
        })
        .catch(() => setTools([])),
      fetch("/webapi/proxy/a2a/agent-card", { credentials: "include", headers: { Accept: "application/json" } })
        .then((r) => r.ok ? r.json() : null)
        .then((card: Record<string, unknown> | null) => {
          if (card) {
            setAgentCard(card);
            const cardSkills = (card.skills ?? []) as Array<{ id?: string; name?: string; description?: string }>;
            setSkills(cardSkills.map((s) => ({ name: s.id ?? s.name ?? "unknown", description: s.description ?? "" })));
          }
        })
        .catch(() => null),
    ]).finally(() => setLoading(false));
  }, [api]);

  const toolColumns: DataColumn<ToolRow>[] = [
    { id: "name", header: "Tool", cell: (row) => <span className="font-mono text-sm">{row.name}</span>, sortable: true, sortValue: (row) => row.name },
    { id: "description", header: "Description", cell: (row) => row.description, sortable: true, sortValue: (row) => row.description },
    { id: "parameters", header: "Parameters", cell: (row) => <span className="font-mono text-xs">{row.parameters}</span>, sortable: true, sortValue: (row) => row.parameters },
    { id: "returnType", header: "Return Type", cell: (row) => <span className="font-mono text-xs">{row.returnType}</span> },
  ];

  const skillColumns: DataColumn<SkillRow>[] = [
    { id: "name", header: "Skill", cell: (row) => <span className="font-mono text-sm">{row.name}</span>, sortable: true, sortValue: (row) => row.name },
    { id: "description", header: "Description", cell: (row) => row.description, sortable: true, sortValue: (row) => row.description },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">OpenAPI and runtime interface entry points for the notification agent.</p>
        <Input type="search" placeholder="Search API docs..." className="max-w-sm" aria-label="Search" />
      </header>

      {/* DW3: Tab navigation via @cloud-dog/ui Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP Tools ({tools.length})</TabsTrigger>
          <TabsTrigger value="a2a">A2A Skills ({skills.length})</TabsTrigger>
        </TabsList>

        {/* DW4: OpenAPI display */}
        <TabsContent value="api">
          <ApiDocsPanel
            openapiUrl={`${cfg.API_BASE_URL.replace(/\/$/, "")}/openapi.json`}
            links={[
              { label: "API", href: cfg.API_BASE_URL },
              { label: "MCP", href: mcpBase },
              { label: "A2A", href: a2aBase },
              { label: "WebUI", href: window.location.origin },
            ]}
          />
        </TabsContent>

        {/* DW5: MCP Tool Reference — live from endpoint */}
        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">MCP Tools ({tools.length})</h2>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading tools...</div>
              ) : (
                <DataTable tableId="notification-mcp-tools" columns={toolColumns} rows={tools} emptyMessage="No MCP tools available." getRowId={(row) => row.name} pageSize={20} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DW6: A2A Skill Reference — live from agent card */}
        <TabsContent value="a2a">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">A2A Skills ({skills.length})</h2>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading skills...</div>
              ) : skills.length > 0 ? (
                <DataTable tableId="notification-a2a-skills" columns={skillColumns} rows={skills} emptyMessage="No A2A skills available." getRowId={(row) => row.name} pageSize={20} />
              ) : (
                <p className="text-sm text-muted-foreground">No A2A agent card or skills available at {a2aBase}/.well-known/agent.json</p>
              )}
              {agentCard ? (
                <div className="mt-4">
                  <JsonBlock title="Agent Card" value={agentCard} defaultCollapsed />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PS-74 DW2: Service Documentation */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Service Documentation</h2></CardHeader>
        <CardContent>
          <DocumentViewer
            content={`# Notification Agent

Multi-channel notification delivery service supporting SMTP, SMS, WhatsApp, and chat with LLM-powered formatting and translation.

## Request / Response Schema

All API endpoints accept JSON request bodies and return JSON response objects. See the API Reference tab for detailed schema examples.

Authentication: session cookie (web UI) or API key header (programmatic access).`}
            format="auto"
            title="notification-agent Documentation"
            downloadFilename="notification-agent-README.md"
            maxHeight="400px"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Environment Settings</h2></CardHeader>
        <CardContent>
          <DataTable
            tableId="notification-api-docs-environment"
            columns={[
              { id: "name", header: "Setting", cell: (row: { name: string; value: string }) => row.name },
              { id: "value", header: "Value", cell: (row: { name: string; value: string }) => row.value },
            ]}
            rows={[
              { name: "API_BASE_URL", value: cfg.API_BASE_URL },
              { name: "MCP_BASE_URL", value: mcpBase },
              { name: "A2A_BASE_URL", value: a2aBase },
            ]}
            getRowId={(row) => row.name}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}
