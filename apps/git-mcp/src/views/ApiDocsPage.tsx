// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// PS-74 Docs Page — git-mcp implementation with live MCP discovery.

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import {
  ApiDocsPanel,
  Badge,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  JsonBlock,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataColumn,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL: string;
  A2A_BASE_URL?: string;
}>;

type McpTool = Readonly<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
type A2ASkill = Readonly<{ id: string; name: string; description: string }>;

// Static RBAC map for display alongside live tools
const TOOL_RBAC: Record<string, string> = {
  git_status: "git:repo:read", git_log: "git:commit:read", git_diff: "git:diff:read",
  git_show: "git:commit:read", git_branch_list: "git:branch:read", git_branch_create: "git:branch:write",
  file_read: "git:file:read", file_write: "git:file:write", file_list: "git:file:read",
  search_files: "git:file:read", search_paths: "git:file:read", dir_create: "git:file:write",
  admin_profile_list: "git:admin:*", admin_profile_create: "git:admin:*",
};

const toolColumns: DataColumn<McpTool>[] = [
  { id: "name", header: "Tool", cell: (r) => <code className="text-sm">{r.name}</code>, sortable: true, sortValue: (r) => r.name },
  { id: "description", header: "Description", cell: (r) => r.description || "\u2014" },
  {
    id: "params", header: "Parameters",
    cell: (r) => {
      const props = (r.inputSchema as Record<string, unknown>)?.properties;
      if (!props || typeof props !== "object") return "\u2014";
      return Object.keys(props).join(", ");
    },
  },
  {
    id: "permission", header: "RBAC Permission",
    cell: (r) => <span className="font-mono text-xs">{TOOL_RBAC[r.name] ?? "git:tool:execute"}</span>,
  },
];

const skillColumns: DataColumn<A2ASkill>[] = [
  { id: "id", header: "Skill ID", cell: (r) => <code className="text-sm">{r.id}</code>, sortable: true, sortValue: (r) => r.id },
  { id: "name", header: "Name", cell: (r) => r.name },
  { id: "description", header: "Description", cell: (r) => r.description },
];

export function ApiDocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api } = useGitMcpState();
  const baseUrl = cfg.API_BASE_URL.replace(/\/$/, "");
  const mcpBase = cfg.MCP_BASE_URL.replace(/\/$/, "");
  const a2aBase = (cfg.A2A_BASE_URL ?? `${baseUrl}/a2a`).replace(/\/$/, "");
  const [tab, setTab] = React.useState("api");
  const [tools, setTools] = React.useState<McpTool[]>([]);
  const [skills, setSkills] = React.useState<A2ASkill[]>([]);
  const [toolError, setToolError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  // Live MCP tool discovery
  React.useEffect(() => {
    fetch(`${mcpBase}/mcp/tools`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        const list = (data.tools ?? data.items ?? []) as McpTool[];
        setTools(Array.isArray(list) ? list : []);
      })
      .catch((e) => setToolError(e instanceof Error ? e.message : "Failed to load MCP tools"));
  }, [mcpBase]);

  // Live A2A skill discovery
  React.useEffect(() => {
    fetch(`${a2aBase}/.well-known/agent.json`)
      .then((r) => r.json())
      .then((card: Record<string, unknown>) => {
        const sk = (card.skills ?? []) as A2ASkill[];
        setSkills(Array.isArray(sk) ? sk : []);
      })
      .catch(() => {
        // Fallback to static
        setSkills([
          { id: "read_file", name: "Read File", description: "Read a file from a git repository" },
          { id: "write_file", name: "Write File", description: "Write a file to a git repository" },
          { id: "health", name: "Health", description: "Check git-mcp health" },
        ]);
      });
  }, [a2aBase]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">OpenAPI, MCP tool reference, and A2A skill reference (PS-74).</p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary">Authenticated via session or API key</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              Reference tabs include request, response, schema, and example details from the live service surfaces.
            </p>
          </div>
          <Input
            aria-label="Search API Docs"
            className="md:max-w-xs"
            placeholder="Search API docs..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
          />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP Tools ({tools.length || "\u2026"})</TabsTrigger>
          <TabsTrigger value="a2a">A2A Skills ({skills.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <ApiDocsPanel
            mode="swagger"
            openapiUrl={`${baseUrl}/docs`}
            links={[
              { label: "OpenAPI JSON", href: `${baseUrl}/openapi.json` },
              { label: "MCP Tools", href: `${mcpBase}/mcp/tools` },
              { label: "A2A Agent Card", href: `${a2aBase}/.well-known/agent.json` },
            ]}
          />
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">MCP Tools (Live Discovery)</h2>
              <p className="text-sm text-muted-foreground">Fetched from <code className="text-xs">{mcpBase}/mcp/tools</code>. RBAC permissions from static map.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {toolError ? <p className="text-sm text-destructive">{toolError}</p> : null}
              <DataTable columns={toolColumns} rows={tools} emptyMessage="No MCP tools discovered." getRowId={(r) => r.name} tableId="git-mcp-tools" columnPickerEnabled pageSize={25} />
              {tools.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Tool Schemas</h3>
                  {tools.slice(0, 5).map((tool) => (
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
              <h2 className="text-lg font-semibold">A2A Skills</h2>
              <p className="text-sm text-muted-foreground">Fetched from <code className="text-xs">{a2aBase}/.well-known/agent.json</code>.</p>
            </CardHeader>
            <CardContent>
              <DataTable columns={skillColumns} rows={skills} emptyMessage="No A2A skills discovered." getRowId={(r) => r.id} tableId="git-a2a-skills" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
