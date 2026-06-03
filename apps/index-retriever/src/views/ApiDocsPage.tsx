// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// PS-74 Docs Page WebUI Standard — index-retriever implementation.
// W28A-814: Replaced static MCP_TOOLS/A2A_SKILLS with runtime fetches.

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
  type DataColumn,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
}>;

type McpTool = Readonly<{ name: string; description: string; parameters: string; returnType: string }>;
type A2ASkill = Readonly<{ id: string; name: string; description: string }>;

function asRecord(v: unknown): JsonRecord {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as JsonRecord) : {};
}

const toolColumns: DataColumn<McpTool>[] = [
  { id: "name", header: "Tool Name", cell: (r) => <span className="font-mono text-xs">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
  { id: "description", header: "Description", cell: (r) => r.description, sortable: true, sortValue: (r) => r.description },
  { id: "parameters", header: "Parameters", cell: (r) => <span className="text-xs text-muted-foreground">{r.parameters}</span> },
  { id: "returnType", header: "Return Type", cell: (r) => <span className="text-xs">{r.returnType}</span> },
];

const skillColumns: DataColumn<A2ASkill>[] = [
  { id: "id", header: "Skill ID", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortable: true, sortValue: (r) => r.id },
  { id: "name", header: "Name", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
  { id: "description", header: "Description", cell: (r) => r.description },
];

export function ApiDocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();
  const origin = window.location.origin;
  const docsUrl = new URL("/docs", cfg.API_BASE_URL || origin).toString();
  const mcpBase = (cfg.MCP_BASE_URL || `${origin}/mcp`).replace(/\/$/, "");
  const a2aBase = `${origin}/a2a`;
  const a2aAgentCardUrl = React.useMemo(() => {
    return new URL("/a2a/.well-known/agent.json", origin).toString();
  }, [origin]);

  const [tab, setTab] = React.useState("api");
  const [mcpTools, setMcpTools] = React.useState<McpTool[]>([]);
  const [mcpLoading, setMcpLoading] = React.useState(true);
  const [a2aSkills, setA2aSkills] = React.useState<A2ASkill[]>([]);
  const [a2aLoading, setA2aLoading] = React.useState(true);

  // DW5: Live MCP tool fetch via tool_list MCP tool or JSON-RPC
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setMcpLoading(true);
      try {
        const toolDescriptors = await app.api.listTools();
        const tools = Array.isArray(toolDescriptors) ? toolDescriptors : [];
        if (!cancelled) {
          setMcpTools(tools.map((t: JsonRecord) => ({
            name: String(t.name ?? ""),
            description: String(t.description ?? ""),
            parameters: t.input_schema ? JSON.stringify(t.input_schema) : "{}",
            returnType: "MCP tool result (JSON/text)",
          })));
        }
      } catch {
        if (!cancelled) setMcpTools([]);
      } finally {
        if (!cancelled) setMcpLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [app, mcpBase]);

  // DW6: Live A2A skill fetch from agent.json
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setA2aLoading(true);
      try {
        const resp = await fetch(a2aAgentCardUrl, { credentials: "include" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const card = await resp.json();
        const skills = Array.isArray(card.skills) ? card.skills : [];
        if (!cancelled) {
          setA2aSkills(skills.map((s: JsonRecord) => ({
            id: String(s.id ?? ""),
            name: String(s.name ?? ""),
            description: String(s.description ?? ""),
          })));
        }
      } catch {
        if (!cancelled) setA2aSkills([]);
      } finally {
        if (!cancelled) setA2aLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [a2aAgentCardUrl]);

  const [searchQuery, setSearchQuery] = React.useState("");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">API reference, MCP tool catalogue, and A2A skill reference (PS-74). Authenticated session active.</p>
      </header>

      <div className="max-w-sm">
        <input
          type="search"
          role="searchbox"
          placeholder="Search API docs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP Tools ({mcpLoading ? "…" : mcpTools.length})</TabsTrigger>
          <TabsTrigger value="a2a">A2A Skills ({a2aLoading ? "…" : a2aSkills.length})</TabsTrigger>
        </TabsList>

        {/* DW4 — OpenAPI */}
        <TabsContent value="api">
          <ApiDocsPanel
            openapiUrl={docsUrl}
            links={[
              { label: "API docs", href: docsUrl },
              { label: "OpenAPI JSON", href: new URL("/openapi.json", cfg.API_BASE_URL || origin).toString() },
              { label: "MCP", href: mcpBase },
              { label: "A2A", href: a2aBase },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">Request and response examples are shown in the schema above. See the OpenAPI spec for full request/response schema definitions.</p>
        </TabsContent>

        {/* DW5 — Live MCP tool reference */}
        <TabsContent value="mcp">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">MCP Tool Reference</h2></CardHeader>
            <CardContent className="space-y-4">
              {mcpLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading tools…</div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{mcpTools.length} tools from live registry.</p>
                  <DataTable columns={toolColumns} rows={mcpTools} getRowId={(r) => r.name} emptyMessage="No MCP tools." pageSize={25} columnPickerEnabled tableId="idx-mcp-tools" />
                  {mcpTools.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <h3 className="text-sm font-semibold">Tool Schemas</h3>
                      {mcpTools.map((t) => <JsonBlock key={t.name} title={t.name} value={t} defaultCollapsed />)}
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Vector Search Reference</h2></CardHeader>
            <CardContent>
              <JsonBlock title="Search Parameters" value={{ query: "string", top_k: "int (default 10)", score_threshold: "float (0.0-1.0)", filter: "object", collection: "string" }} defaultCollapsed={false} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DW6 — Live A2A skill reference */}
        <TabsContent value="a2a">
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">A2A Skill Reference</h2></CardHeader>
            <CardContent className="space-y-4">
              {a2aLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading skills…</div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{a2aSkills.length} skills from <code className="text-xs">/.well-known/agent.json</code>.</p>
                  <DataTable columns={skillColumns} rows={a2aSkills} getRowId={(r) => r.id} emptyMessage="No A2A skills." tableId="idx-a2a-skills" />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DW2 — Document Viewer */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Service Documentation</h2></CardHeader>
        <CardContent>
          <DocumentViewer
            content={`# Index Retriever\n\nVector database indexing and retrieval service with multi-provider support (Qdrant, ChromaDB, OpenSearch) and semantic search.`}
            format="auto"
            title="index-retriever Documentation"
            downloadFilename="index-retriever-README.md"
            maxHeight="400px"
          />
        </CardContent>
      </Card>
    </div>
  );
}
