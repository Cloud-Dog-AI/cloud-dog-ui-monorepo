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

// @cloud-dog/app-notification-agent — API documentation page (PS-74 DW1-DW7).
// CX-120 / W28E-615: a single shared ApiDocsPanel renders exactly four tabs
// (API Reference + Swagger UI on /openapi.json, MCP Reference, A2A Reference,
// README). MCP tools and A2A skills carry description + example curl + example
// output + auth note; the panel surfaces the shared WorkedExamplePopup (CX-150).

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import { ApiDocsPanel, type A2aSkillDoc, type McpToolDoc } from "@cloud-dog/ui";
import { useNotificationAgentState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
}>;

const AUTH_NOTE = "Authenticated via browser session cookie (Web UI) or API key header (programmatic).";

// CX-120 — inline notification-agent README so the shared ApiDocsPanel renders the README tab.
const README_CONTENT = `# Notification Agent

Multi-channel notification platform composed of four servers (API/REST, MCP, A2A, Web UI/Admin).
It accepts requests to notify users across email, SMS, WhatsApp, and chat with LLM-formatted,
optionally translated content.

## Surfaces

- REST API — submit notifications, manage channels, users, groups, prompts, and inspect deliveries/jobs.
- MCP — tool catalogue exposed over JSON-RPC for agentic clients.
- A2A — agent-to-agent skills surfaced via the agent card.

## Notes

- Slow/bulk mutations may be submitted asynchronously and tracked as jobs.
- Channels, groups, and prompts drive multi-tenant delivery routing.
- All admin surfaces are authenticated via session cookie or API key.
`;

export function ApiDocsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api } = useNotificationAgentState();

  const [tools, setTools] = React.useState<McpToolDoc[]>([]);
  const [skills, setSkills] = React.useState<A2aSkillDoc[]>([]);

  React.useEffect(() => {
    void Promise.all([
      api
        .listMcpTools()
        .then((list) => {
          setTools(
            list.map((t) => ({
              name: t.name,
              description: t.description ?? "",
              parameters: t.inputSchema ?? {},
              authNote: AUTH_NOTE,
            })),
          );
        })
        .catch(() => setTools([])),
      fetch("/webapi/proxy/a2a/agent-card", { credentials: "include", headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((card: Record<string, unknown> | null) => {
          if (!card) return;
          const cardSkills = (card.skills ?? []) as Array<{
            id?: string;
            name?: string;
            description?: string;
            inputSchema?: unknown;
          }>;
          setSkills(
            cardSkills.map((s) => ({
              name: s.id ?? s.name ?? "unknown",
              description: s.description ?? "",
              inputSchema: s.inputSchema,
              authNote: AUTH_NOTE,
            })),
          );
        })
        .catch(() => null),
    ]);
  }, [api]);

  const mcpBase = cfg.MCP_BASE_URL ?? `${window.location.origin}/mcp`;
  const a2aBase = cfg.A2A_BASE_URL ?? `${window.location.origin}/a2a`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">
          OpenAPI Swagger reference, MCP tool catalogue, A2A skills, and README for the notification agent.
        </p>
      </header>

      {/* CX-120 / CX-150: shared four-tab ApiDocsPanel (Swagger + MCP + A2A + README). */}
      <ApiDocsPanel
        openapiUrl={`${cfg.API_BASE_URL.replace(/\/$/, "")}/openapi.json`}
        mode="swagger"
        mcpTools={tools}
        a2aSkills={skills}
        readmeContent={README_CONTENT}
        readmeTitle="notification-agent README"
        links={[
          { label: "OpenAPI JSON", href: `${cfg.API_BASE_URL.replace(/\/$/, "")}/openapi.json` },
          { label: "MCP Console", href: "/mcp-console" },
          { label: "A2A Console", href: "/a2a-console" },
          { label: "MCP", href: mcpBase },
          { label: "A2A", href: a2aBase },
        ]}
      />
    </div>
  );
}
