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

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import { Badge, Card, CardContent, CardHeader, type McpToolDef } from '@cloud-dog/ui';
import { ServiceStatusBar } from '@cloud-dog/shell';
import {
  ErrorState,
  LoadingState,
  PageFrame,
  PanelCard,
  requestJson,
  useApiResource,
} from '../lib/sqlAgentApi';
import { Ps72McpConsole, type Ps72McpTool } from '../components/ps72/Ps72McpConsole';
import type { Ps72ExecuteResult, Ps72HealthState } from '../components/ps72/metaTypes';

type AppRuntimeConfig = {
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  AUTH_MODE?: string;
};

type McpHealth = {
  status?: string;
  endpoints?: Record<string, unknown>;
};

type ToolsListResponse = {
  result?: {
    tools?: Array<{
      name?: string;
      description?: string;
      inputSchema?: unknown;
    }>;
  };
};

function toHealthStatus(status: string | undefined): 'ok' | 'warning' | 'error' {
  const normalised = `${status ?? ''}`.toLowerCase();
  if (normalised.includes('healthy') || normalised.includes('ok') || normalised.includes('ready')) return 'ok';
  if (normalised.includes('warn') || normalised.includes('start')) return 'warning';
  return 'error';
}

function asSchemaRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function McpPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const auth = useAuth();
  const authModeLabel =
    cfg.AUTH_MODE === 'cookie' || cfg.AUTH_MODE === undefined
      ? 'browser session cookie'
      : String(cfg.AUTH_MODE);
  const health = useApiResource<McpHealth>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/mcp/health'),
    [cfg.API_BASE_URL],
  );
  const mcpEndpointUrl = cfg.MCP_BASE_URL ?? `${cfg.API_BASE_URL}/mcp`;
  const tools = useApiResource<McpToolDef[]>(
    async () => {
      const payload = await requestJson<ToolsListResponse>(mcpEndpointUrl, '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 46301,
          method: 'tools/list',
          params: {},
        }),
      });
      return (payload.result?.tools ?? [])
        .filter((tool) => tool.name)
        .map((tool) => ({
          name: tool.name as string,
          description: tool.description ?? '',
          inputSchema: asSchemaRecord(tool.inputSchema),
        }));
    },
    [mcpEndpointUrl],
  );

  // PS-72 v2 §5 / W28A-774 T.1.6: capture X-Correlation-Id / X-Request-Id response
  // headers (emitted by the sql-agent web proxy) so the meta panel can cross-check
  // against the API log. requestJson() discards headers, so execute with raw fetch.
  const executeTool = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const requestId = Date.now();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (overrideKey.trim()) {
        headers['X-API-Key'] = overrideKey.trim();
      }
      const response = await fetch(mcpEndpointUrl, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
      });
      const rawText = await response.text();
      let body: unknown = null;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        body = rawText;
      }
      const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const resultObj = record.result && typeof record.result === 'object' ? (record.result as Record<string, unknown>) : null;
      // JSON-RPC transport error OR MCP tool-level error (200 + result.isError) is a denial/failure.
      const isError = 'error' in record || resultObj?.isError === true;
      return {
        body,
        correlationId: response.headers.get('X-Correlation-Id'),
        requestId: response.headers.get('X-Request-Id') ?? String(requestId),
        httpStatus: response.status,
        denied: !response.ok || response.status === 403 || isError,
      };
    },
    [mcpEndpointUrl],
  );

  const toolCatalogue = React.useMemo<Ps72McpTool[]>(
    () =>
      (tools.data ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: asSchemaRecord(tool.inputSchema),
        bound: true,
      })),
    [tools.data],
  );

  const ps72Health: Ps72HealthState = health.loading
    ? 'unknown'
    : health.error
      ? 'unhealthy'
      : toPs72Health(health.data?.status);

  const boundLabel = auth.user?.username ?? auth.user?.displayName ?? 'your session';

  return (
    <PageFrame
      eyebrow="FR-62"
      title="MCP Console"
      description="Exercise the MCP proxy with the PS-72 v2 console: live tool discovery, request templates, API-key handling, inline result, and correlation/request metadata."
    >
      {/* MW4: Auth status display */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Authentication</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          {auth.isLoading ? (
            <span className="text-muted-foreground">Checking session…</span>
          ) : auth.isAuthenticated ? (
            <>
              <Badge variant="default" className="bg-emerald-600 text-white">
                Authenticated
              </Badge>
              <span>
                Authenticated via <strong>{authModeLabel}</strong>
                {auth.user?.displayName ? ` — ${auth.user.displayName}` : null}
              </span>
            </>
          ) : (
            <>
              <Badge variant="destructive">Not authenticated</Badge>
              <span>Sign in to run MCP tools with your Web UI session.</span>
            </>
          )}
        </CardContent>
      </Card>

      {/* 25-12 — Horizontal MCP-only health row (replaces column HealthWidget). */}
      <ServiceStatusBar
        services={[
          {
            name: 'MCP bridge',
            url: mcpEndpointUrl,
            status: health.data ? toHealthStatus(health.data.status) : 'warning',
          },
        ]}
      />
      {health.loading ? <LoadingState label="MCP health" /> : null}
      {health.error ? <ErrorState message={health.error} /> : null}

      {/* W28A-774 — PS-72 v2 conformant MCP Console (sql-agent-local wrapper; promotion
          to shared @cloud-dog/ui McpConsole is the follow-on per "2 then 1"). */}
      <PanelCard
        id="panelMcpTest"
        title="MCP console"
        subtitle="PS-72 v2 console bound to the authenticated Web proxy."
      >
        {tools.loading ? <LoadingState label="MCP tools" /> : null}
        {tools.error ? <ErrorState message={tools.error} /> : null}
        {!tools.loading && !tools.error ? (
          <Ps72McpConsole
            endpointUrl={mcpEndpointUrl}
            tools={toolCatalogue}
            health={ps72Health}
            hasBoundKey={auth.isAuthenticated}
            boundLabel={boundLabel}
            docsHref="/api-docs"
            jobsHref="/jobs"
            onExecute={executeTool}
          />
        ) : null}
      </PanelCard>
    </PageFrame>
  );
}

function toPs72Health(status: string | undefined): Ps72HealthState {
  const normalised = `${status ?? ''}`.toLowerCase();
  if (normalised.includes('healthy') || normalised.includes('ok') || normalised.includes('ready')) return 'healthy';
  if (normalised.includes('warn') || normalised.includes('degrad') || normalised.includes('start')) return 'degraded';
  if (normalised.includes('error') || normalised.includes('fail') || normalised.includes('unhealthy')) return 'unhealthy';
  return 'unknown';
}
