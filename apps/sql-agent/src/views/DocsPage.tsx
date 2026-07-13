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

// @cloud-dog/app-sql-agent — API documentation panel (PS-74 compliant).
// Covers: FR-61
// Standard: PS-74 (Docs Page WebUI Standard) v1.0
//
// W28A snag #25-04 + #25-05 + #25-06: replace bespoke iframe + per-tool
// JSON dump with the canonical `ApiDocsPanel` mode="swagger" pattern.
// MCP tools come from `tools/list` JSON-RPC (count > 0 expected); A2A
// skills come from `/.well-known/agent.json`.

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import {
  ApiDocsPanel,
  type A2aSkillDoc,
  type McpToolDoc,
} from '@cloud-dog/ui';
import { PageFrame, requestJson } from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
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

type AgentCardResponse = {
  name?: string;
  description?: string;
  skills?: Array<{ name?: string; description?: string }>;
};

export function DocsPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const auth = useAuth();
  const [tools, setTools] = React.useState<McpToolDoc[]>([]);
  const [skills, setSkills] = React.useState<A2aSkillDoc[]>([]);

  // 25-04: switch to the same `tools/list` JSON-RPC the McpPage uses, so
  // the registered-tools count is the same on both pages (>0 in preprod).
  React.useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) {
      setTools([]);
      return;
    }
    let cancelled = false;
    const mcpBase = cfg.MCP_BASE_URL ?? `${cfg.API_BASE_URL}/api/mcp/messages`;
    void requestJson<ToolsListResponse>(mcpBase, '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 46302, method: 'tools/list', params: {} }),
    })
      .then((payload) => {
        if (cancelled) return;
        const next: McpToolDoc[] = (payload.result?.tools ?? [])
          .filter((tool) => tool.name)
          .map((tool) => ({
            name: tool.name as string,
            description: tool.description ?? '',
            parameters: tool.inputSchema,
          }));
        setTools(next);
      })
      .catch(() => {
        if (!cancelled) setTools([]);
      });
    return () => { cancelled = true; };
  }, [auth.isAuthenticated, auth.isLoading, cfg.API_BASE_URL, cfg.MCP_BASE_URL]);

  // 25-06: pull agent card; surface name + description + skills list with schema.
  React.useEffect(() => {
    let cancelled = false;
    const a2aBase = cfg.A2A_BASE_URL ?? `${cfg.API_BASE_URL}/a2a`;
    void requestJson<AgentCardResponse>(a2aBase, '/.well-known/agent.json')
      .then((payload) => {
        if (cancelled) return;
        const next: A2aSkillDoc[] = (payload.skills ?? [])
          .filter((s) => s.name)
          .map((s) => ({
            name: s.name as string,
            description: s.description ?? '',
          }));
        setSkills(next);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => { cancelled = true; };
  }, [cfg.A2A_BASE_URL, cfg.API_BASE_URL]);

  return (
    <PageFrame
      eyebrow="PS-74"
      title="API Docs"
      description="OpenAPI Swagger reference, MCP tool catalogue, and A2A skills for the sql-agent service."
    >

      <div className="mb-4">
        <input type="search" placeholder="Search API endpoints…" aria-label="Search" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
      </div>
      <p className="text-xs text-muted-foreground mb-2">Authenticated via API key / session cookie</p>
      <ApiDocsPanel
        openapiUrl={`${cfg.API_BASE_URL}/openapi.json`}
        mode="swagger"
        mcpTools={tools}
        a2aSkills={skills}
        links={[
          { label: 'OpenAPI JSON', href: `${cfg.API_BASE_URL}/openapi.json` },
          { label: 'MCP Console', href: '/developer/mcp-console' },
          { label: 'A2A Console', href: '/developer/a2a-console' },
        ]}
      />
    </PageFrame>
  );
}
