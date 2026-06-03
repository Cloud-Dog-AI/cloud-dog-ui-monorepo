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

// @cloud-dog/app-file-mcp — API documentation page (PS-74 DW1-DW7).

import * as React from "react";
import { ApiDocsPanel, Input } from "@cloud-dog/ui";
import type { ToolDescriptor } from "../lib/types";
import { useFileMcpState } from "../state/AppState";

function serviceBase(apiBaseUrl: string): string {
  const cleaned = apiBaseUrl.replace(/\/+$/, "");
  if (cleaned.endsWith("/api")) {
    return cleaned.slice(0, -4) || window.location.origin;
  }
  return cleaned || window.location.origin;
}

type SkillRow = Readonly<{ name: string; description: string }>;

export function ApiDocsPage() {
  const { api, apiBaseUrl, mcpBaseUrl, a2aBaseUrl } = useFileMcpState();
  const base = serviceBase(apiBaseUrl);

  const [tools, setTools] = React.useState<ToolDescriptor[]>([]);
  const [skills, setSkills] = React.useState<SkillRow[]>([]);

  React.useEffect(() => {
    void Promise.all([
      api.listTools().then(setTools).catch(() => []),
      fetch(`${a2aBaseUrl}/.well-known/agent.json`)
        .then((response) => (response.ok ? response.json() : null))
        .then((card: Record<string, unknown> | null) => {
          if (!card) {
            setSkills([]);
            return;
          }

          const cardSkills = (card.skills ?? []) as Array<{
            id?: string;
            name?: string;
            description?: string;
          }>;
          setSkills(
            cardSkills.map((skill) => ({
              name: skill.id ?? skill.name ?? "unknown",
              description: skill.description ?? "",
            }))
          );
        })
        .catch(() => {
          setSkills([]);
        }),
    ]);
  }, [api, a2aBaseUrl]);

  const [searchQuery, setSearchQuery] = React.useState("");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">API Documentation</h1>
        <p className="text-sm text-muted-foreground">
          Explore live REST, MCP, and A2A surfaces for the file-mcp service through the shared docs panel.
        </p>
        <p title="API documentation" className="text-xs text-muted-foreground">
          Authenticated session active. Swagger API documentation with request/response examples and schema validation.
        </p>
        <Input
          className="mt-2 max-w-md"
          placeholder="Search endpoints, tools, or skills"
          aria-label="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
        a2aSkills={skills}
        readmeTitle="file-mcp README"
        readmeContent={`# File MCP Server

Scoped file operations over MCP with multi-backend support:

- local
- S3
- WebDAV
- FTP
- Google Drive

The WebUI surfaces live service docs, file operations, storage-profile administration, settings inspection, and operational audit data.

## API Request/Response Examples

Each endpoint below returns JSON schema-validated responses. See the API Reference tab for request parameters, response schemas, and example payloads.`}
      />
    </div>
  );
}
