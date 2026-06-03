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

// @cloud-dog/app-imap-mcp — API documentation route using the shared ApiDocsPanel tabs.

import * as React from "react";
import { ApiDocsPanel, Input } from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";
import type { ToolDescriptor } from "../lib/types";

function serviceBase(apiBaseUrl: string): string {
  const cleaned = apiBaseUrl.replace(/\/+$/, "");
  if (cleaned.endsWith("/api")) return cleaned.slice(0, -4) || window.location.origin;
  return cleaned || window.location.origin;
}

type SkillRow = Readonly<{
  name: string;
  description: string;
}>;

const README_CONTENT = `# IMAP MCP Server

IMAP email operations over MCP with mailbox management, message search, attachment handling, and profile-scoped access.

## Protocol Notes

- IMAP4rev1 (RFC 3501) with IDLE, SORT, and SEARCH extensions
- Profile-scoped mailbox access with configurable include and exclude globs
- Attachment extraction supports inline and multipart MIME structures
- Message indexing supports cache-backed and live IMAP retrieval modes
`;

export function ApiDocsPage() {
  const { api, apiBaseUrl, mcpBaseUrl, a2aBaseUrl } = useImapMcpState();
  const base = serviceBase(apiBaseUrl);

  const [tools, setTools] = React.useState<ToolDescriptor[]>([]);
  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    void Promise.all([
      api
        .listMcpTools()
        .then((result) => {
          if (result.ok && result.data) {
            setTools(result.data);
          }
        })
        .catch(() => undefined),
      fetch(`${a2aBaseUrl}/.well-known/agent.json`)
        .then((response) => (response.ok ? response.json() : null))
        .then((card: Record<string, unknown> | null) => {
          const cardSkills = Array.isArray(card?.skills) ? (card.skills as Array<Record<string, unknown>>) : [];
          setSkills(
            cardSkills.map((skill) => ({
              name: String(skill.id ?? skill.name ?? "unknown"),
              description: String(skill.description ?? ""),
            })),
          );
        })
        .catch(() => setSkills([])),
    ]);
  }, [a2aBaseUrl, api]);

  const effectiveSkills = skills.length > 0
    ? skills
    : [{
        name: "Unavailable",
        description: `No A2A agent card available at ${a2aBaseUrl}/.well-known/agent.json`,
      }];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">API Docs</h1>
        <p className="text-sm text-muted-foreground">
          Swagger view of the OpenAPI spec, MCP tool catalogue, A2A skill catalogue,
          and the service README. All entries are sourced from the live service —
          if any tab is empty the backend isn't reporting that surface.
        </p>
        <Input
          className="mt-2 max-w-md"
          placeholder="Search endpoints, tools, or skills"
          aria-label="Search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </header>

      <ApiDocsPanel
        openapiUrl={`${base}/openapi.json`}
        mode="swagger"
        links={[
          { label: "MCP tools", href: `${mcpBaseUrl}/tools` },
          { label: "A2A health", href: `${a2aBaseUrl}/health` },
          { label: "Health", href: `${base}/health` },
          { label: "Status", href: `${base}/status` },
        ]}
        mcpTools={tools.map((tool) => ({
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.input_schema ?? {},
        }))}
        a2aSkills={effectiveSkills}
        readmeContent={README_CONTENT}
        readmeTitle="imap-mcp README"
      />
    </div>
  );
}
