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
import { Badge, Ps72McpConsole } from '@cloud-dog/ui';
import { useConfig } from '@cloud-dog/config';
import { useNotificationAgentState } from '../state/AppState';
import type { Ps72ExecuteResult, Ps72McpTool } from '@cloud-dog/ui';

type RuntimeConfig = Readonly<{
  MCP_BASE_URL?: string;
}>;

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api, latestFailure, captureFailure } = useNotificationAgentState();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);

  React.useEffect(() => {
    void (async () => {
      try {
        const items = await api.listMcpTools();
        setTools(items.map((tool) => ({
          name: tool.name,
          description: tool.description ?? undefined,
          inputSchema: tool.inputSchema,
        })));
      } catch (error) {
        captureFailure(error);
      }
    })();
  }, [api, captureFailure]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">MCP Console</h1>
        <Badge variant="default">session auth</Badge>
      </header>
      <p className="text-sm text-muted-foreground">Shared MCP console backed by the authenticated web proxy ({tools.length} tools loaded).</p>
      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      <Ps72McpConsole
        endpointUrl={cfg.MCP_BASE_URL ?? '/mcp'}
        tools={tools}
        health="unknown"
        hasBoundKey={true}
        boundLabel="session bound key"
        docsHref="/api-docs"
        jobsHref="/jobs"
        onExecute={async (toolName, args, overrideKey): Promise<Ps72ExecuteResult> => {
          const requestId = `mcp-${crypto.randomUUID()}`;
          const correlationId = `corr-${crypto.randomUUID()}`;
          try {
            const body = await api.callMcpTool(toolName, args, {
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
