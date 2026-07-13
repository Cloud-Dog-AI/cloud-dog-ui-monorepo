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
import { Badge, Card, CardContent, CardHeader, JsonBlock, Ps72A2aConsole } from '@cloud-dog/ui';
import type { Ps72ExecuteResult, Ps72HealthState } from '@cloud-dog/ui';
import { useConfig } from '@cloud-dog/config';
import { useNotificationAgentState } from '../state/AppState';

type RuntimeConfig = Readonly<{
  A2A_BASE_URL?: string;
}>;

type AgentSkill = Readonly<{
  id?: string;
  name?: string;
  description?: string;
  inputSchema?: unknown;
  examples?: unknown[];
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
  const [agentCard, setAgentCard] = React.useState<AgentCard | null>(null);
  const [agentCardError, setAgentCardError] = React.useState<string | null>(null);
  // CX-131: clicking a skill on the left panel pre-fills the task console topic
  // and payload defaults derived from the skill's inputSchema.
  const [selectedSkill, setSelectedSkill] = React.useState<{ topic: string; payload: unknown } | null>(null);

  const skills = React.useMemo(
    () => [...new Set((agentCard?.skills ?? []).map((s) => s.id ?? s.name ?? '').filter(Boolean))],
    [agentCard],
  );
  const health: Ps72HealthState = agentCard ? 'healthy' : agentCardError ? 'unhealthy' : 'unknown';

  const skillDefaults = React.useCallback((skill: AgentSkill): unknown => {
    if (Array.isArray(skill.examples) && skill.examples.length > 0) return skill.examples[0];
    const schema = skill.inputSchema as { properties?: Record<string, unknown> } | undefined;
    const props = schema?.properties;
    if (props && typeof props === 'object') {
      return Object.fromEntries(Object.keys(props).map((k) => [k, '']));
    }
    return {};
  }, []);

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
          setAgentCard(payload);
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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">A2A Console</h1>
        <p className="text-sm text-muted-foreground">Shared A2A console routed through the authenticated web proxy.</p>
      </header>
      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {agentCardError ? <p role="alert" className="text-sm text-destructive">{agentCardError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Agent card</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {agentCard ? (
              <>
                <div className="space-y-1">
                  <p className="text-base font-semibold">{agentCard.name ?? 'Unknown agent'}</p>
                  <p className="text-muted-foreground">{agentCard.description ?? 'No description provided.'}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="font-medium">Version</p>
                    <p className="text-muted-foreground">{agentCard.version ?? 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Endpoint</p>
                    <p className="break-all text-muted-foreground">{agentCard.url || endpointUrl}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">Capabilities</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={agentCard.capabilities?.streaming ? 'default' : 'secondary'}>
                      Streaming {agentCard.capabilities?.streaming ? 'enabled' : 'disabled'}
                    </Badge>
                    <Badge variant={agentCard.capabilities?.pushNotifications ? 'default' : 'secondary'}>
                      Push notifications {agentCard.capabilities?.pushNotifications ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">Skills</p>
                  <div className="space-y-2">
                    {(agentCard.skills ?? []).map((skill) => (
                      <button
                        key={skill.id ?? skill.name}
                        type="button"
                        data-testid="a2a-skill"
                        className="w-full rounded-md border px-3 py-2 text-left hover:border-primary hover:bg-muted/40"
                        title={`Pre-fill task console with ${skill.name ?? skill.id}`}
                        onClick={() =>
                          setSelectedSkill({ topic: skill.id ?? skill.name ?? '', payload: skillDefaults(skill) })
                        }
                      >
                        <p className="font-medium">{skill.name ?? skill.id ?? 'Unnamed skill'}</p>
                        <p className="text-muted-foreground">
                          {skill.description ?? 'No skill description provided.'}
                        </p>
                      </button>
                    ))}
                    {(agentCard.skills ?? []).length === 0 ? (
                      <p className="text-muted-foreground">No skills advertised by the A2A agent.</p>
                    ) : null}
                  </div>
                </div>

                <JsonBlock title="Agent Card" value={agentCard} defaultCollapsed />
              </>
            ) : (
              <p className="text-muted-foreground">Loading agent card…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold">A2A Task Response</h2></CardHeader>
          <CardContent>
        <Ps72A2aConsole
          endpointUrl={endpointUrl}
          agentCard={agentCard as Record<string, unknown> | null}
          skills={skills}
          initialAction={selectedSkill?.topic}
          initialRequest={selectedSkill?.payload}
          health={health}
          hasBoundKey
          boundLabel="session"
          docsHref="/developer/api-docs"
          jobsHref="/system/jobs"
          onSend={async (action, payload): Promise<Ps72ExecuteResult> => {
            try {
              const data = await api.sendA2a(action, payload);
              return { body: data, correlationId: null, requestId: null, httpStatus: 200, denied: false };
            } catch (error) {
              return {
                body: { error: error instanceof Error ? error.message : String(error) },
                correlationId: null,
                requestId: null,
                httpStatus: 502,
                denied: true,
              };
            }
          }}
        />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
