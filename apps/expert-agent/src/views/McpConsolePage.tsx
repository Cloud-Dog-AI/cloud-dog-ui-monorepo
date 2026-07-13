// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// @cloud-dog/app-expert-agent — MCP console (PS-72 MW2, MW4, MW5).

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import {
  Input,
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from '@cloud-dog/ui';
import { PageScaffold, resolveMcpBaseUrl } from './shared';


type RuntimeConfig = Readonly<{
  MCP_BASE_URL?: string;
  AUTH_MODE?: string;
}>;

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>('unknown');
  const [error, setError] = React.useState<string | null>(null);
  const [contextExpertId, setContextExpertId] = React.useState('');
  const [contextChannelId, setContextChannelId] = React.useState('');
  const [contextSessionId, setContextSessionId] = React.useState('');
  const endpointUrl = React.useMemo(() => resolveMcpBaseUrl(cfg.MCP_BASE_URL), [cfg.MCP_BASE_URL]);

  React.useEffect(() => {
    void fetch(endpointUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
      .then(async (response) => response.json())
      .then((payload) => {
        const nextTools = Array.isArray(payload.result?.tools) ? payload.result.tools : [];
        setTools(nextTools.map((tool: { name: string; description?: string; inputSchema?: unknown; input_schema?: unknown }) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema ?? tool.input_schema,
        })));
        setHealth(nextTools.length > 0 ? 'healthy' : 'degraded');
        setError(null);
      })
      .catch((loadError) => {
        setTools([]);
        setHealth('unhealthy');
        setError(loadError instanceof Error ? loadError.message : 'Failed to load MCP tools');
      });
  }, [endpointUrl]);

  const authModeLabel =
    cfg.AUTH_MODE === 'cookie' || cfg.AUTH_MODE === undefined
      ? 'browser session cookie'
      : String(cfg.AUTH_MODE);

  return (
    <PageScaffold
      title="MCP Console"
      description="Shared MCP console for listing and executing live MCP tools (PS-72)."
      alert={null}
    >
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Ps72McpConsole
        endpointUrl={endpointUrl}
        tools={tools}
        health={health}
        hasBoundKey={auth.isAuthenticated}
        boundLabel={auth.isLoading ? 'checking session' : auth.isAuthenticated ? `session • ${authModeLabel}` : 'not signed in'}
        docsHref="/developer/api-docs"
        jobsHref="/system/jobs"
        extensionSlot={
          <div className="flex flex-wrap gap-3">
          <label className="space-y-1 text-sm">
            <span>Expert ID</span>
            <Input value={contextExpertId} onChange={(e) => setContextExpertId(e.target.value)} placeholder="e.g. 1" aria-label="Expert ID" className="w-32" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Channel ID</span>
            <Input value={contextChannelId} onChange={(e) => setContextChannelId(e.target.value)} placeholder="e.g. 1" aria-label="Channel ID" className="w-32" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Session ID</span>
            <Input value={contextSessionId} onChange={(e) => setContextSessionId(e.target.value)} placeholder="e.g. 1" aria-label="Session ID" className="w-32" />
          </label>
          </div>
        }
        requestAdapter={(_toolName, args) => {
          const merged = { ...(args && typeof args === 'object' ? args as Record<string, unknown> : {}) };
          if (contextExpertId && merged.expert_id === undefined && merged.expert_config_id === undefined) merged.expert_id = Number(contextExpertId) || contextExpertId;
          if (contextChannelId && merged.channel_id === undefined) merged.channel_id = Number(contextChannelId) || contextChannelId;
          if (contextSessionId && merged.session_id === undefined) merged.session_id = Number(contextSessionId) || contextSessionId;
          return merged;
        }}
        onExecute={async (toolName, args, overrideKey): Promise<Ps72ExecuteResult> => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (overrideKey.trim()) headers['X-API-Key'] = overrideKey.trim();
          const response = await fetch(endpointUrl, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: { name: toolName, arguments: args },
            }),
          });
          const body = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
          return {
            body,
            correlationId: response.headers.get('X-Correlation-Id') ?? response.headers.get('x-correlation-id'),
            requestId: response.headers.get('X-Request-Id') ?? response.headers.get('x-request-id') ?? (body?.id ? String(body.id) : null),
            httpStatus: response.status,
            denied: !response.ok || Boolean(body?.error),
          };
        }}
      />
    </PageScaffold>
  );
}
