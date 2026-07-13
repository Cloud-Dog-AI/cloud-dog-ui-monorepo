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
import { Badge, Card, CardContent, CardHeader, HealthWidget, JsonBlock } from '@cloud-dog/ui';
import {
  DataList,
  ErrorState,
  LoadingState,
  PageFrame,
  PanelCard,
  requestJson,
  useApiResource,
} from '../lib/sqlAgentApi';
import { Ps72A2aConsole } from '@cloud-dog/ui';
import type { Ps72ExecuteResult, Ps72HealthState } from '@cloud-dog/ui';

type AppRuntimeConfig = {
  API_BASE_URL: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
};

type ServerStatus = {
  running?: boolean;
  pid?: number;
  url?: string;
  status?: string;
};

function toHealthStatus(status: string | undefined, running?: boolean): 'ok' | 'warning' | 'error' | 'unknown' {
  if (running === true) return 'ok';
  if (running === false) return 'error';
  const normalised = `${status ?? ''}`.toLowerCase();
  if (normalised.includes('ok') || normalised.includes('healthy') || normalised.includes('running')) return 'ok';
  if (normalised.includes('warn') || normalised.includes('start')) return 'warning';
  if (normalised.includes('error') || normalised.includes('fail') || normalised.includes('stopped')) return 'error';
  return 'unknown';
}

function buildA2aWsUrl(): string {
  if (typeof window === 'undefined') {
    return '/web/api/a2a/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const runtimeConfig = (window as Window & { __RUNTIME_CONFIG__?: AppRuntimeConfig }).__RUNTIME_CONFIG__;
  const configuredBaseUrl = runtimeConfig?.A2A_BASE_URL;
  if (configuredBaseUrl) {
    const configuredUrl = new URL(configuredBaseUrl, window.location.origin);
    configuredUrl.protocol = protocol;
    return configuredUrl.toString();
  }
  return `${protocol}//${window.location.host}/web/api/a2a/ws`;
}

export function A2APage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const auth = useAuth();
  const authModeLabel =
    cfg.AUTH_MODE === 'cookie' || cfg.AUTH_MODE === undefined
      ? 'browser session cookie'
      : String(cfg.AUTH_MODE);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    const a2aBase = cfg.A2A_BASE_URL ?? cfg.API_BASE_URL;
    fetch(`${a2aBase}/.well-known/agent.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((card: Record<string, unknown> | null) => {
        if (card) setAgentCard(card);
      })
      .catch(() => null);
  }, [cfg.A2A_BASE_URL, cfg.API_BASE_URL]);

  const status = useApiResource<ServerStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/servers/a2a/status'),
    [cfg.API_BASE_URL],
  );

  const sendA2a = React.useCallback(
    async (topic: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const wsUrl = buildA2aWsUrl();
      return new Promise<Ps72ExecuteResult>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timer = window.setTimeout(() => {
          ws.close();
          reject(new Error('Timed out waiting for A2A response.'));
        }, 15000);

        ws.onopen = () => {
          const base = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
          const envelope: Record<string, unknown> = { action: topic, ...base };
          if (overrideKey.trim()) {
            envelope.api_key = overrideKey.trim();
          }
          ws.send(JSON.stringify(envelope));
        };
        ws.onmessage = (event) => {
          window.clearTimeout(timer);
          let body: unknown;
          try {
            body = JSON.parse(String(event.data));
          } catch {
            body = { raw: String(event.data) };
          } finally {
            ws.close();
          }
          // §5/§8.4: correlation_id and request_id come in the message payload.
          const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
          const metaRecord = record.meta && typeof record.meta === 'object' ? (record.meta as Record<string, unknown>) : record;
          const denied =
            record.error !== undefined ||
            `${record.status ?? ''}`.toLowerCase().includes('denied') ||
            `${record.status ?? ''}`.toLowerCase().includes('forbidden');
          resolve({
            body,
            correlationId: (metaRecord.correlation_id as string) ?? (record.correlation_id as string) ?? null,
            requestId: (metaRecord.request_id as string) ?? (record.request_id as string) ?? null,
            httpStatus: denied ? 403 : 200,
            denied,
          });
        };
        ws.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('A2A WebSocket request failed.'));
        };
        ws.onclose = () => {
          window.clearTimeout(timer);
        };
      });
    },
    [],
  );

  const skills = React.useMemo<string[]>(() => {
    const raw = agentCard?.skills ?? agentCard?.capabilities;
    if (Array.isArray(raw)) {
      return raw
        .map((item) =>
          typeof item === 'string'
            ? item
            : item && typeof item === 'object'
              ? String((item as Record<string, unknown>).id ?? (item as Record<string, unknown>).name ?? '')
              : '',
        )
        .filter(Boolean);
    }
    return ['root', 'health'];
  }, [agentCard]);

  const ps72Health: Ps72HealthState = status.loading
    ? 'unknown'
    : status.error
      ? 'unhealthy'
      : status.data?.running === false
        ? 'unhealthy'
        : agentCard
          ? 'healthy'
          : 'degraded';

  const boundLabel = auth.user?.username ?? auth.user?.displayName ?? 'your session';

  return (
    <PageFrame
      eyebrow="FR-63"
      title="A2A Console"
      description="Drive the A2A bridge with the PS-72 v2 console: agent card, events stream, request templates, API-key handling, inline result, and correlation/request metadata."
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
              <span>Sign in to run A2A tasks with your Web UI session.</span>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <PanelCard id="panelA2aTest" title="A2A server status" subtitle="Live proxy status for the A2A bridge">
          <h2 className="text-lg font-semibold">A2A Test</h2>
          <div className="text-sm font-medium text-slate-700">History</div>
          {status.loading ? <LoadingState label="A2A status" /> : null}
          {status.error ? <ErrorState message={status.error} /> : null}
          {status.data ? (
            <div className="space-y-4">
              <HealthWidget
                name="A2A bridge"
                status={toHealthStatus(status.data.status, status.data.running)}
                detail={status.data.status ?? 'N/A'}
              />
              <DataList
                items={[
                  { label: 'PID', value: status.data.pid ?? 'N/A' },
                  { label: 'Server URL', value: status.data.url ?? cfg.A2A_BASE_URL ?? 'N/A' },
                ]}
              />
            </div>
          ) : null}
        </PanelCard>

        <PanelCard title="A2A transport" subtitle="PS-72 v2 console bound to `/api/a2a/ws` through the Web proxy">
          <Ps72A2aConsole
            endpointUrl={buildA2aWsUrl()}
            agentCard={agentCard}
            skills={skills}
            health={ps72Health}
            hasBoundKey={auth.isAuthenticated}
            boundLabel={boundLabel}
            docsHref="/developer/api-docs"
            jobsHref="/system/jobs"
            onSend={sendA2a}
          />
        </PanelCard>
      </div>

      {/* Raw agent card (audit aid) */}
      {agentCard ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Agent Card (raw)</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title="/.well-known/agent.json" value={agentCard} defaultCollapsed={false} />
          </CardContent>
        </Card>
      ) : null}
    </PageFrame>
  );
}
