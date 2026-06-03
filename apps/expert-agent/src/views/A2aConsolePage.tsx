// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// @cloud-dog/app-expert-agent — A2A Console (PS-72 v2).
// W28A-770R: migrated from the pre-v2 A2aConsole widget to the shared
// @cloud-dog/ui Ps72A2aConsole (PS-72 v2 §1-§9 + §8 agent card + events stream).
// The agent card is fetched from the A2A card endpoint; skills/topics drive the
// action template. Tasks are broadcast to the live A2A server (/broadcast/{topic});
// correlation_id/request_id come from the X-Request-Id response header (T.1.6).

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import { Ps72A2aConsole, type Ps72ExecuteResult, type Ps72HealthState } from '@cloud-dog/ui';
import { PageScaffold } from './shared';

type RuntimeConfig = Readonly<{
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
}>;

function extractSkills(card: Record<string, unknown> | null): string[] {
  const raw = card && Array.isArray(card.skills) ? (card.skills as Array<{ id?: string; name?: string }>) : [];
  const ids = raw.map((s) => String(s.id ?? s.name ?? '').trim()).filter(Boolean);
  return Array.from(new Set(['status', ...ids]));
}

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  // Same-origin web-proxy path (not the direct service origin) so the proxy
  // injects the session Bearer token and forwards X-Request-Id (T.1.6).
  const endpointUrl = React.useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const configured = cfg.A2A_BASE_URL;
    if (configured && origin && configured.startsWith(origin)) return configured;
    if (configured && !origin) return configured;
    return `${origin}/a2a`;
  }, [cfg.A2A_BASE_URL]);
  const agentCardUrl = React.useMemo(
    () => new URL('.well-known/agent.json', `${endpointUrl.replace(/\/$/, '')}/`).toString(),
    [endpointUrl],
  );

  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>('unknown');

  React.useEffect(() => {
    let cancelled = false;
    void fetch(agentCardUrl, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as Record<string, unknown>;
      })
      .then((json) => {
        if (!cancelled) {
          setAgentCard(json);
          setHealth('healthy');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAgentCard(null);
          setHealth('unhealthy');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentCardUrl]);

  const onSend = React.useCallback(
    async (action: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (overrideKey && overrideKey.trim()) headers['X-API-Key'] = overrideKey.trim();
      const resp = await fetch(`${endpointUrl}/broadcast/${encodeURIComponent(action)}`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload && typeof payload === 'object' ? payload : { value: payload }),
      });
      const body: unknown = await resp.json().catch(() => ({ error: 'Invalid JSON response' }));
      const requestId = resp.headers.get('X-Request-Id') ?? resp.headers.get('x-request-id');
      const correlationId = resp.headers.get('X-Correlation-Id') ?? resp.headers.get('x-correlation-id') ?? requestId;
      const denied = !resp.ok || (body && typeof body === 'object' && Boolean((body as Record<string, unknown>).error));
      return { body, correlationId, requestId, httpStatus: resp.status, denied: Boolean(denied) };
    },
    [endpointUrl],
  );

  const hasBoundKey = auth.isAuthenticated;
  const boundLabel = auth.isAuthenticated ? `session • ${auth.user?.displayName ?? auth.user?.username ?? 'cookie'}` : 'not signed in';

  return (
    <PageScaffold
      title="A2A Console"
      description="PS-72 v2 A2A console for sending topic payloads to the live A2A server."
      alert={null}
    >
      <Ps72A2aConsole
        endpointUrl={endpointUrl}
        agentCard={agentCard}
        skills={extractSkills(agentCard)}
        health={health}
        hasBoundKey={hasBoundKey}
        boundLabel={boundLabel}
        docsHref="/api-docs"
        jobsHref="/jobs"
        onSend={onSend}
      />
    </PageScaffold>
  );
}
