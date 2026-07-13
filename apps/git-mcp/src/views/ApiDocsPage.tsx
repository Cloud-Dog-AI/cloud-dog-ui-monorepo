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
  const { api, apiKey } = useGitMcpState();
  const baseUrl = cfg.API_BASE_URL.replace(/\/$/, "");
  const mcpBase = cfg.MCP_BASE_URL.replace(/\/$/, "");
  const a2aBase = (cfg.A2A_BASE_URL ?? `${baseUrl}/a2a`).replace(/\/$/, "");
  const [tab, setTab] = React.useState("api");
  const [tools, setTools] = React.useState<McpTool[]>([]);
  const [skills, setSkills] = React.useState<A2ASkill[]>([]);
  const [toolError, setToolError] = React.useState<string | null>(null);
  const [skillError, setSkillError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const q = search.trim().toLowerCase();
  const filteredTools = React.useMemo(
    () => (q ? tools.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q)) : tools),
    [tools, q],
  );
  const filteredSkills = React.useMemo(
    () => (q ? skills.filter((s) => `${s.id} ${s.name} ${s.description}`.toLowerCase().includes(q)) : skills),
    [skills, q],
  );

  // GM-AD-02: live MCP tool discovery through the authenticated platform api-client (was an
  // unauthenticated raw fetch that 401'd on the secured surface, so the tab never loaded).
  React.useEffect(() => {
    let cancelled = false;
    setToolError(null);
    void (async () => {
      try {
        const descriptors = await api.listMcpTools(apiKey);
        if (cancelled) return;
        setTools(descriptors.map((d) => ({ name: d.name, description: d.description ?? "", inputSchema: d.input_schema })));
      } catch (e) {
        if (!cancelled) setToolError(e instanceof Error ? e.message : "Failed to load MCP tools.");
      }
    })();
    return () => { cancelled = true; };
  }, [api, apiKey]);

  // GM-AD-02: live A2A skill discovery — surface fetch failures instead of silently substituting
  // a misleading static skill list.
  React.useEffect(() => {
    let cancelled = false;
    setSkillError(null);
    void (async () => {
      try {
        const resp = await fetch(`${a2aBase}/.well-known/agent.json`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!resp.ok) throw new Error(`Agent card request failed (HTTP ${resp.status}).`);
        const card = (await resp.json()) as Record<string, unknown>;
        if (cancelled) return;
        const sk = (card.skills ?? []) as A2ASkill[];
        setSkills(Array.isArray(sk) ? sk : []);
      } catch (e) {
        if (cancelled) return;
        setSkillError(e instanceof Error ? e.message : "Failed to load A2A skills.");
        setSkills([]);
      }
    })();
    return () => { cancelled = true; };
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
            openapiUrl={`${baseUrl}/openapi.json`}
            links={[{ label: "OpenAPI JSON", href: `${baseUrl}/openapi.json` }]}
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
              <DataTable columns={toolColumns} rows={filteredTools} emptyMessage="No MCP tools discovered." getRowId={(r) => r.name} tableId="git-mcp-tools" columnPickerEnabled pageSize={25} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="a2a">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">A2A Skills</h2>
              <p className="text-sm text-muted-foreground">Fetched from <code className="text-xs">{a2aBase}/.well-known/agent.json</code>. Per-skill documentation (id, name, description) for every advertised A2A skill.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {skillError ? <p className="text-sm text-destructive">{skillError}</p> : null}
              <DataTable columns={skillColumns} rows={filteredSkills} emptyMessage="No A2A skills discovered." getRowId={(r) => r.id} tableId="git-a2a-skills" columnPickerEnabled pageSize={25} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
