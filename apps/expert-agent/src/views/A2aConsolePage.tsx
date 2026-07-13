// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

// @cloud-dog/app-expert-agent — A2A console (PS-72 MW3, MW4, MW5).

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import { Badge, Button, Card, CardContent, CardHeader, JsonBlock, Ps72A2aConsole } from '@cloud-dog/ui';
import type { Ps72ExecuteResult, Ps72HealthState } from '@cloud-dog/ui';
import { PageScaffold, resolveA2aBaseUrl } from './shared';


type RuntimeConfig = Readonly<{
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
}>;

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const endpointUrl = React.useMemo(() => resolveA2aBaseUrl(cfg.A2A_BASE_URL), [cfg.A2A_BASE_URL]);

  const agentCardUrl = React.useMemo(
    () => new URL('.well-known/agent.json', `${endpointUrl.replace(/\/$/, '')}/`).toString(),
    [endpointUrl]
  );

  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [agentCardError, setAgentCardError] = React.useState<string | null>(null);
  const [topics, setTopics] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    setAgentCardError(null);
    void fetch(agentCardUrl, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((json) => {
        if (!cancelled) {
          setAgentCard(json);
          const skills = Array.isArray(json.skills) ? json.skills as Array<{ id?: string; name?: string }> : [];
          setTopics([...new Set(['status', ...skills.map((s) => s.id ?? s.name ?? '').filter(Boolean)])]);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAgentCard(null);
          setAgentCardError(error instanceof Error ? error.message : 'Failed to load agent card.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentCardUrl]);

  const authModeLabel =
    cfg.AUTH_MODE === 'cookie' || cfg.AUTH_MODE === undefined
      ? 'browser session cookie'
      : String(cfg.AUTH_MODE);

  const health: Ps72HealthState = agentCard ? 'healthy' : agentCardError ? 'unhealthy' : 'unknown';

  return (
    <PageScaffold
      title="A2A Console"
      description="Shared A2A console for sending topic payloads to the live A2A server (PS-72)."
      alert={null}
    >
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
              <span>Sign in to use the A2A console with your Web UI session.</span>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Agent card</h2>
          <Button variant="secondary" size="sm" asChild>
            <a href={agentCardUrl} target="_blank" rel="noopener noreferrer">
              Open /.well-known/agent.json
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          {agentCardError ? (
            <p className="text-sm text-muted-foreground" role="status">
              {agentCardError}
            </p>
          ) : (
            <JsonBlock title="A2A agent card" value={agentCard ?? { status: 'loading' }} defaultCollapsed={false} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">A2A Task Response</h2></CardHeader>
        <CardContent>
          <Ps72A2aConsole
            endpointUrl={endpointUrl}
            agentCard={agentCard}
            skills={topics}
            health={health}
            hasBoundKey={auth.isAuthenticated}
            boundLabel={auth.user?.displayName ?? 'session'}
            docsHref="/developer/api-docs"
            jobsHref="/system/jobs"
            onSend={async (action, payload): Promise<Ps72ExecuteResult> => {
              const response = await fetch(`${endpointUrl}/broadcast/${encodeURIComponent(action)}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const body = await response.json().catch(() => ({}));
              return {
                body,
                correlationId: response.headers.get('X-Correlation-Id'),
                requestId: response.headers.get('X-Request-Id'),
                httpStatus: response.status,
                denied: !response.ok,
              };
            }}
          />
        </CardContent>
      </Card>
    </PageScaffold>
  );
}
