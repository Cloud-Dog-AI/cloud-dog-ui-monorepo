// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// @cloud-dog/app-expert-agent — API / MCP / A2A documentation (PS-74).

import * as React from 'react';
import { useConfig } from '@cloud-dog/config';
import {
  ApiDocsPanel,
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
  Input,
  type DataColumn,
  DocumentViewer,
} from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import { PageScaffold, resolveA2aBaseUrl, resolveMcpBaseUrl } from './shared';

type RuntimeConfig = Readonly<{
  WEB_API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
}>;

type McpToolRow = Readonly<{
  name: string;
  description: string;
  parameters: string;
  exampleRequest: string;
  returnType: string;
}>;

type A2aSkillRow = Readonly<{
  id: string;
  name: string;
  description: string;
  inputFormat: string;
  returnType: string;
}>;

function resolveWebApiBaseUrl(cfgUrl: string): string {
  if (typeof window === 'undefined') return cfgUrl.replace(/\/$/, '');
  try {
    return new URL(cfgUrl, window.location.origin).toString().replace(/\/$/, '');
  } catch {
    return cfgUrl.replace(/\/$/, '');
  }
}

const SESSION_KNOWLEDGE_REST = [
  { method: 'GET', path: '/sessions', description: 'List sessions visible to the caller.' },
  { method: 'POST', path: '/sessions', description: 'Create a session (user_id, expert_config_id, title).' },
  { method: 'GET', path: '/sessions/{id}', description: 'Fetch session metadata and state.' },
  { method: 'DELETE', path: '/sessions/{id}', description: 'Delete a session.' },
  { method: 'GET', path: '/knowledge/history', description: 'List knowledge history entries (scoped by permission).' },
  { method: 'POST', path: '/knowledge/history', description: 'Append or update knowledge history content.' },
  { method: 'POST', path: '/files/{file_id}/ingest_to_knowledge', description: 'Ingest an uploaded file into knowledge history.' },
] as const;

function buildExampleRequest(toolName: string, inputSchema: unknown): string {
  const exampleParams: Record<string, unknown> = {};
  if (inputSchema && typeof inputSchema === 'object' && !Array.isArray(inputSchema)) {
    const properties = (inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    for (const [key, property] of Object.entries(properties)) {
      const typeName =
        property && typeof property === 'object' && !Array.isArray(property)
          ? String((property as { type?: unknown }).type ?? 'string')
          : 'string';
      exampleParams[key] =
        typeName === 'number' || typeName === 'integer' ? 0 :
        typeName === 'boolean' ? false :
        typeName === 'array' ? [] :
        typeName === 'object' ? {} :
        `<${key}>`;
    }
  }
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: exampleParams } });
}

export function ApiDocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [tab, setTab] = React.useState('api');
  const [summary, setSummary] = React.useState<Record<string, unknown> | null>(null);
  const [runtimeConfig, setRuntimeConfig] = React.useState<Record<string, unknown> | null>(null);
  const [mcpTools, setMcpTools] = React.useState<McpToolRow[]>([]);
  const [mcpLoading, setMcpLoading] = React.useState(true);
  const [a2aSkills, setA2aSkills] = React.useState<A2aSkillRow[]>([]);
  const [a2aLoading, setA2aLoading] = React.useState(true);

  const webApiBase = resolveWebApiBaseUrl(cfg.WEB_API_BASE_URL);
  const mcpBase = resolveMcpBaseUrl(cfg.MCP_BASE_URL);
  const a2aBase = resolveA2aBaseUrl(cfg.A2A_BASE_URL);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      clearFailure();
      try {
        const [nextSummary, nextConfig] = await Promise.all([
          api.getApiDocs(),
          api.getRuntimeConfig().catch(() => null),
        ]);
        if (active) {
          setSummary(nextSummary as Record<string, unknown>);
          if (nextConfig) setRuntimeConfig(nextConfig);
        }
      } catch (error) {
        captureFailure(error);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    let cancelled = false;
    const loadMcp = async () => {
      setMcpLoading(true);
      const endpoint = mcpBase.replace(/\/$/, '');
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        });
        if (!response.ok) throw new Error(`MCP tools/list HTTP ${response.status}`);
        const payload = (await response.json()) as {
          result?: { tools?: Array<{ name?: string; description?: string; inputSchema?: unknown }> };
        };
        const list = payload.result?.tools ?? [];
        if (cancelled) return;
        setMcpTools(
          list.map((t) => ({
            name: String(t.name ?? ''),
            description: String(t.description ?? ''),
            parameters:
              t.inputSchema !== undefined ? JSON.stringify(t.inputSchema) : '{}',
            exampleRequest: buildExampleRequest(String(t.name ?? ''), t.inputSchema),
            returnType: 'MCP tool result (structured JSON / text content)',
          }))
        );
      } catch {
        try {
          const toolsUrl = new URL('tools', `${endpoint}/`).toString();
          const fallback = await fetch(toolsUrl, { credentials: 'include' });
          if (!fallback.ok) throw new Error(`MCP tools HTTP ${fallback.status}`);
          const body = (await fallback.json()) as { tools?: Array<{ name?: string; description?: string }> };
          const list = body.tools ?? [];
          if (cancelled) return;
          setMcpTools(
            list.map((t) => ({
              name: String(t.name ?? ''),
              description: String(t.description ?? ''),
              parameters: '{}',
              exampleRequest: buildExampleRequest(String(t.name ?? ''), {}),
              returnType: 'MCP tool result (structured JSON / text content)',
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
  }, [mcpBase]);

  React.useEffect(() => {
    let cancelled = false;
    const loadA2a = async () => {
      setA2aLoading(true);
      try {
        const cardUrl = new URL('.well-known/agent.json', `${a2aBase.replace(/\/$/, '')}/`).toString();
        const response = await fetch(cardUrl, { credentials: 'include' });
        if (!response.ok) throw new Error(`A2A card HTTP ${response.status}`);
        const payload = (await response.json()) as { skills?: Array<{ id?: string; name?: string; description?: string }> };
        const skills = payload.skills ?? [];
        if (cancelled) return;
        setA2aSkills(
          skills.map((s) => ({
            id: String(s.id ?? ''),
            name: String(s.name ?? ''),
            description: String(s.description ?? ''),
            inputFormat: 'A2A task message with JSON payload accepted by the agent card skill.',
            returnType: 'A2A task status/result JSON',
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
  }, [a2aBase]);

  const knowledgeMcpRows = React.useMemo(
    () => mcpTools.filter((row) => /vector|knowledge|session/i.test(row.name)),
    [mcpTools]
  );

  const mcpColumns: DataColumn<McpToolRow>[] = [
    {
      id: 'name',
      header: 'Tool',
      cell: (row) => <span className="font-mono text-sm">{row.name}</span>,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => row.description,
      sortable: true,
      sortValue: (row) => row.description,
    },
    {
      id: 'parameters',
      header: 'Parameters',
      cell: (row) => <span className="text-xs text-muted-foreground">{row.parameters}</span>,
      sortable: false,
    },
    {
      id: 'exampleRequest',
      header: 'Example request',
      cell: (row) => <span className="text-xs text-muted-foreground">{row.exampleRequest}</span>,
      sortable: false,
    },
    {
      id: 'returnType',
      header: 'Return type',
      cell: (row) => <span className="text-xs">{row.returnType}</span>,
      sortable: false,
    },
  ];

  const a2aColumns: DataColumn<A2aSkillRow>[] = [
    {
      id: 'id',
      header: 'Skill id',
      cell: (row) => <span className="font-mono text-sm">{row.id}</span>,
      sortable: true,
      sortValue: (row) => row.id,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => row.name,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => row.description,
      sortable: true,
      sortValue: (row) => row.description,
    },
    {
      id: 'inputFormat',
      header: 'Input format',
      cell: (row) => <span className="text-xs text-muted-foreground">{row.inputFormat}</span>,
      sortable: false,
    },
    {
      id: 'returnType',
      header: 'Return type',
      cell: (row) => <span className="text-xs">{row.returnType}</span>,
      sortable: false,
    },
  ];

  const knowledgeColumns: DataColumn<McpToolRow>[] = mcpColumns;

  return (
    <PageScaffold
      title="API Docs"
      description="OpenAPI contract, MCP tool catalogue, A2A skills, and session/knowledge surfaces for expert-agent. All endpoints accept JSON request bodies and return JSON response schema objects."
      alert={latestFailure}
    >
      <Input type="search" placeholder="Search API docs..." className="mb-4 max-w-sm" aria-label="Search" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1" aria-label="Documentation sections">
          <TabsTrigger value="api">API reference</TabsTrigger>
          <TabsTrigger value="mcp">MCP tools</TabsTrigger>
          <TabsTrigger value="a2a">A2A skills</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge &amp; sessions</TabsTrigger>
          <TabsTrigger value="runtime">Runtime config</TabsTrigger>
        </TabsList>

        <TabsContent value="api">
          <div className="space-y-4">
            <ApiDocsPanel
              openapiUrl={`${window.location.origin}/openapi.json`}
              links={[
                { label: 'OpenAPI JSON', href: `${webApiBase}/openapi.json` },
                { label: 'Swagger UI', href: `${webApiBase}/docs` },
                { label: 'API summary', href: `${webApiBase}/docs/api` },
                { label: 'ReDoc', href: `${webApiBase}/redoc` },
                { label: 'MCP tools (HTTP)', href: new URL('tools', `${mcpBase.replace(/\/$/, '')}/`).toString() },
                { label: 'A2A health', href: new URL('health', `${a2aBase.replace(/\/$/, '')}/`).toString() },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">MCP tools ({mcpTools.length})</h2>
              <p className="text-sm text-muted-foreground">
                Live catalogue from <span className="font-mono">GET /mcp/tools</span> (same contract as JSON-RPC{' '}
                <span className="font-mono">tools/list</span>).
              </p>
            </CardHeader>
            <CardContent>
              {mcpLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Loading tools…
                </div>
              ) : (
                <DataTable
                  tableId="expert-agent-api-docs-mcp-tools"
                  columns={mcpColumns}
                  rows={mcpTools}
                  getRowId={(row) => row.name}
                  emptyMessage="No MCP tools returned. Check MCP health and authentication."
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
                Agent card from <span className="font-mono">GET /.well-known/agent.json</span> on the A2A service.
              </p>
            </CardHeader>
            <CardContent>
              {a2aLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Loading skills…
                </div>
              ) : (
                <DataTable
                  tableId="expert-agent-api-docs-a2a-skills"
                  columns={a2aColumns}
                  rows={a2aSkills}
                  getRowId={(row) => row.id}
                  emptyMessage="No A2A skills in the agent card, or the A2A service is unreachable."
                  pageSize={20}
                  columnPickerEnabled={false}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Session management &amp; knowledge (REST)</h2>
                <p className="text-sm text-muted-foreground">Key REST paths for session and knowledge management.</p>
              </CardHeader>
              <CardContent>
                <DataTable
                  tableId="expert-agent-api-docs-session-knowledge-rest"
                  columns={[
                    { id: 'method', header: 'Method', sortable: true, sortValue: (r: (typeof SESSION_KNOWLEDGE_REST)[number]) => r.method, cell: (r: (typeof SESSION_KNOWLEDGE_REST)[number]) => <span className="font-mono text-xs">{r.method}</span> },
                    { id: 'path', header: 'Path', sortable: true, sortValue: (r: (typeof SESSION_KNOWLEDGE_REST)[number]) => r.path, cell: (r: (typeof SESSION_KNOWLEDGE_REST)[number]) => <span className="font-mono text-xs">{r.path}</span> },
                    { id: 'description', header: 'Purpose', sortable: false, cell: (r: (typeof SESSION_KNOWLEDGE_REST)[number]) => r.description },
                  ]}
                  rows={[...SESSION_KNOWLEDGE_REST]}
                  getRowId={(r) => `${r.method}:${r.path}`}
                  emptyMessage="No endpoints."
                  columnPickerEnabled={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Knowledge-oriented MCP tools ({knowledgeMcpRows.length})</h2>
                <p className="text-sm text-muted-foreground">
                  Subset of the MCP catalogue covering sessions, vectors, and knowledge helpers.
                </p>
              </CardHeader>
              <CardContent>
                {mcpLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="h-5 w-5" /> Loading tools…
                  </div>
                ) : (
                  <DataTable
                    tableId="expert-agent-api-docs-knowledge-mcp"
                    columns={knowledgeColumns}
                    rows={knowledgeMcpRows}
                    getRowId={(row) => row.name}
                    emptyMessage="No knowledge or session MCP tools matched."
                    pageSize={20}
                    columnPickerEnabled={false}
                  />
                )}
              </CardContent>
            </Card>

            {summary ? (
              <JsonBlock title="GET /docs/api — developer summary payload" value={summary} defaultCollapsed={false} />
            ) : null}

            <Card>
              <CardHeader><h2 className="text-lg font-semibold">Service Documentation</h2></CardHeader>
              <CardContent>
                <DocumentViewer
                  content={`# Expert Agent

AI-powered expert knowledge agent providing channel-based chat with LLM integration, knowledge management, and multi-provider support.`}
                  format="auto"
                  title="Expert Agent Documentation"
                  downloadFilename="expert-agent-README.md"
                  maxHeight="400px"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runtime">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Runtime configuration</h2>
              <p className="text-sm text-muted-foreground">
                Live runtime settings from <span className="font-mono">GET /runtime-config-dump</span>. Secret values are masked by the backend.
              </p>
            </CardHeader>
            <CardContent>
              {runtimeConfig ? (
                <JsonBlock title="Runtime config" value={runtimeConfig} defaultCollapsed={false} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Runtime configuration is not available. The endpoint may require authentication or is not exposed.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageScaffold>
  );
}
