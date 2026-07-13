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

// @cloud-dog/app-notification-agent — Shared MCP console page.
// Covers: UI-R4

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import {
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';

type RuntimeConfig = Readonly<{
  MCP_BASE_URL?: string;
}>;

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const { api, latestFailure, captureFailure } = useNotificationAgentState();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>('unknown');

  React.useEffect(() => {
    void (async () => {
      try {
        const items = await api.listMcpTools();
        setTools(items.map((tool) => ({
          name: tool.name,
          description: tool.description ?? undefined,
          inputSchema: tool.inputSchema,
        })));
        setHealth(items.length > 0 ? 'healthy' : 'degraded');
      } catch (error) {
        setTools([]);
        setHealth('unhealthy');
        captureFailure(error);
      }
    })();
  }, [api, captureFailure]);

  return (
    <div className="space-y-3">
      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      <Ps72McpConsole
        endpointUrl={cfg.MCP_BASE_URL ?? '/mcp'}
        tools={tools}
        health={health}
        hasBoundKey={auth.isAuthenticated}
        boundLabel={auth.isAuthenticated ? 'session • cookie' : 'not signed in'}
        docsHref="/developer/api-docs"
        jobsHref="/system/jobs"
        onExecute={async (toolName, args): Promise<Ps72ExecuteResult> => {
          try {
            const body = await api.callMcpTool(toolName, args);
            return {
              body,
              correlationId: null,
              requestId: null,
              httpStatus: 200,
              denied: false,
            };
          } catch (error) {
            return {
              body: { error: error instanceof Error ? error.message : String(error) },
              correlationId: null,
              requestId: null,
              httpStatus: 500,
              denied: true,
            };
          }
        }}
      />
    </div>
  );
}
