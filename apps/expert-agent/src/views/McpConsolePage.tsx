// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// @cloud-dog/app-expert-agent — MCP Console (PS-72 v2).
// W28A-770R: migrated from the pre-v2 McpConsole widget to the shared
// @cloud-dog/ui Ps72McpConsole (PS-72 v2 §1-§9 layout + data-testid contract).
// expert-agent's MCP surface is direct JSON-RPC at MCP_BASE_URL (proxied /mcp,
// the web server injects the session Bearer token). correlation_id/request_id
// come from the X-Request-Id response header (cloud_dog_logging); the async job
// id is read from the tool result body (query_async) and surfaces the Jobs link.

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import { Card, CardContent, CardHeader, Input, Ps72McpConsole, type Ps72ExecuteResult, type Ps72HealthState, type Ps72McpTool } from '@cloud-dog/ui';
import { PageScaffold } from './shared';

type RuntimeConfig = Readonly<{
  MCP_BASE_URL?: string;
  AUTH_MODE?: string;
}>;

type RpcTool = { name: string; description?: string; inputSchema?: unknown };

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  // Same-origin web-proxy path (not the direct service origin): the proxy injects
  // the session Bearer token and forwards X-Request-Id, so correlation_id is real
  // (not client-generated) and matches the API log (T.1.6).
  const endpointUrl = React.useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const configured = cfg.MCP_BASE_URL;
    if (configured && origin && configured.startsWith(origin)) return configured;
    if (configured && !origin) return configured;
    return `${origin}/mcp`;
  }, [cfg.MCP_BASE_URL]);

  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>('unknown');
  const [contextExpertId, setContextExpertId] = React.useState('');
  const [contextChannelId, setContextChannelId] = React.useState('');
  const [contextSessionId, setContextSessionId] = React.useState('');

  // Full discoverable tool list (T.1.1) via JSON-RPC tools/list.
  React.useEffect(() => {
    let cancelled = false;
    void fetch(endpointUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
      .then(async (response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const list: RpcTool[] = Array.isArray(payload.result?.tools) ? payload.result.tools : [];
        setTools(list.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })));
        setHealth(list.length > 0 ? 'healthy' : 'degraded');
      })
      .catch(() => {
        if (!cancelled) {
          setTools([]);
          setHealth('unhealthy');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endpointUrl]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const merged: Record<string, unknown> = { ...(args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {}) };
      if (contextExpertId && merged.expert_id === undefined && merged.expert_config_id === undefined) merged.expert_id = Number(contextExpertId) || contextExpertId;
      if (contextChannelId && merged.channel_id === undefined) merged.channel_id = Number(contextChannelId) || contextChannelId;
      if (contextSessionId && merged.session_id === undefined) merged.session_id = Number(contextSessionId) || contextSessionId;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (overrideKey && overrideKey.trim()) headers['X-API-Key'] = overrideKey.trim();
      const resp = await fetch(endpointUrl, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: toolName, arguments: merged } }),
      });
      const body: unknown = await resp.json().catch(() => ({ error: 'Invalid JSON response' }));
      const requestId = resp.headers.get('X-Request-Id') ?? resp.headers.get('x-request-id');
      const correlationId = resp.headers.get('X-Correlation-Id') ?? resp.headers.get('x-correlation-id') ?? requestId;
      const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const result = rec.result && typeof rec.result === 'object' ? (rec.result as Record<string, unknown>) : {};
      const sc = result.structuredContent && typeof result.structuredContent === 'object' ? (result.structuredContent as Record<string, unknown>) : {};
      const jobId =
        (typeof sc.job_id === 'string' ? sc.job_id : null) ??
        (typeof result.job_id === 'string' ? result.job_id : null) ??
        (typeof rec.job_id === 'string' ? rec.job_id : null);
      const denied = !resp.ok || Boolean(rec.error) || result.isError === true;
      return { body, correlationId, requestId, httpStatus: resp.status, denied, jobId };
    },
    [endpointUrl, contextExpertId, contextChannelId, contextSessionId],
  );

  const hasBoundKey = auth.isAuthenticated;
  const boundLabel = auth.isAuthenticated ? `session • ${auth.user?.displayName ?? auth.user?.username ?? 'cookie'}` : 'not signed in';

  return (
    <PageScaffold
      title="MCP Console"
      description="PS-72 v2 MCP console for listing and executing live MCP tools."
      alert={null}
    >
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Context variables</h2>
          <p className="text-sm text-muted-foreground">Pre-fill common IDs merged into tool parameters. Leave empty to omit.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
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
        </CardContent>
      </Card>

      <Ps72McpConsole
        endpointUrl={endpointUrl}
        tools={tools}
        health={health}
        hasBoundKey={hasBoundKey}
        boundLabel={boundLabel}
        docsHref="/api-docs"
        jobsHref="/jobs"
        onExecute={onExecute}
      />
    </PageScaffold>
  );
}
