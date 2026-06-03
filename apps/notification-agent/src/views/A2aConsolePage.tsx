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

// @cloud-dog/app-notification-agent — Shared A2A console page.
// Covers: UI-R4

import * as React from 'react';
import { Ps72A2aConsole } from '@cloud-dog/ui';
import { useConfig } from '@cloud-dog/config';
import { useNotificationAgentState } from '../state/AppState';
import type { Ps72ExecuteResult } from '@cloud-dog/ui';

type RuntimeConfig = Readonly<{
  A2A_BASE_URL?: string;
}>;

type AgentSkill = Readonly<{
  id?: string;
  name?: string;
  description?: string;
}>;

type AgentCard = Readonly<{
  name?: string;
  description?: string;
  url?: string;
  version?: string;
  capabilities?: Readonly<{
    streaming?: boolean;
    pushNotifications?: boolean;
  }>;
  skills?: AgentSkill[];
}>;

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api, latestFailure } = useNotificationAgentState();
  const endpointUrl = cfg.A2A_BASE_URL ?? '/a2a';
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [agentCardError, setAgentCardError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/webapi/proxy/a2a/agent-card', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Failed to load agent card (${response.status}).`);
        }
        const payload = (await response.json()) as AgentCard;
        if (!cancelled) {
          setAgentCard(payload as Record<string, unknown>);
          setAgentCardError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAgentCard(null);
          setAgentCardError(error instanceof Error ? error.message : 'Failed to load agent card.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpointUrl]);

  const skills = React.useMemo(() => {
    const advertised = ((agentCard?.skills as AgentSkill[] | undefined) ?? [])
      .map((skill) => String(skill.id ?? skill.name ?? '').trim())
      .filter(Boolean);
    const merged = new Set(['list_channels', 'get_status', 'send_notification', ...advertised]);
    return Array.from(merged);
  }, [agentCard]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">A2A Console</h1>
        <p className="text-sm text-muted-foreground">Shared A2A console routed through the authenticated web proxy.</p>
      </header>
      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {agentCardError ? <p role="alert" className="text-sm text-destructive">{agentCardError}</p> : null}

      <Ps72A2aConsole
        endpointUrl={endpointUrl}
        agentCard={agentCard}
        skills={skills}
        health={agentCard ? 'unknown' : 'degraded'}
        hasBoundKey={true}
        boundLabel="session bound key"
        docsHref="/api-docs"
        jobsHref="/jobs"
        onSend={async (topic, payload, overrideKey): Promise<Ps72ExecuteResult> => {
          const requestId = `a2a-${crypto.randomUUID()}`;
          const correlationId = `corr-${crypto.randomUUID()}`;
          try {
            const body = await api.sendA2a(topic, payload, {
              requestId,
              correlationId,
              adminOverrideKey: overrideKey,
            });
            return { body, correlationId, requestId, httpStatus: 200, denied: false };
          } catch (error) {
            return {
              body: { error: error instanceof Error ? error.message : String(error) },
              correlationId,
              requestId,
              httpStatus: 500,
              denied: true,
            };
          }
        }}
      />
    </div>
  );
}
