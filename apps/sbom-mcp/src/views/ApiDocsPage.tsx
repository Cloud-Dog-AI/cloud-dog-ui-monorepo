// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { ApiDocsPanel, Spinner } from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader } from "../lib/ui";
import { countOpenApiOperations } from "../lib/api";
import type { A2aAgentCardResponse, McpToolListResponse } from "../lib/types";

type ToolDoc = { name: string; description: string; parameters?: unknown };
type SkillDoc = { name: string; description: string; inputSchema?: unknown };

function normaliseTools(raw: McpToolListResponse): ToolDoc[] {
  const data = raw;
  const list = Array.isArray(data.tools) ? data.tools : Array.isArray(data.items) ? data.items : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as unknown as Record<string, unknown>) : {};
      return {
        name: String(row.name ?? ""),
        description: String(row.description ?? ""),
        parameters: row.inputSchema ?? row.input_schema,
      };
    })
    .filter((row) => row.name);
}

function normaliseSkills(raw: A2aAgentCardResponse): SkillDoc[] {
  const data = raw;
  const list = Array.isArray(data.skills) ? data.skills : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        name: String(row.id ?? row.name ?? ""),
        description: String(row.description ?? ""),
        inputSchema: row.input ?? row.input_schema ?? row.inputSchema,
      };
    })
    .filter((row) => row.name);
}

export function ApiDocsPage() {
  const { api, appVersion } = useSbomState();
  const [tools, setTools] = React.useState<ToolDoc[]>([]);
  const [skills, setSkills] = React.useState<SkillDoc[]>([]);
  const [operationCount, setOperationCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [openapi, toolData, card] = await Promise.all([
          api.getOpenApi(),
          api.mcpTools(),
          api.a2aAgentCard(),
        ]);
        if (!cancelled) {
          setOperationCount(countOpenApiOperations(openapi));
          setTools(normaliseTools(toolData));
          setSkills(normaliseSkills(card));
        }
      } catch {
        if (!cancelled) {
          setOperationCount(0);
          setTools([]);
          setSkills([]);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Docs"
        version={appVersion}
        description="Live OpenAPI, MCP tool, and A2A skill documentation."
      />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner className="h-4 w-4" /> Loading live API catalogues...
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 rounded border bg-muted/20 px-3 py-2 text-sm">
        <span data-testid="api-docs-operation-count" className="font-semibold">
          OpenAPI operations: {operationCount}
        </span>
        <a
          data-testid="api-docs-v1-scans-link"
          className="text-primary underline"
          href="/developer/api-docs#/paths/~1v1~1scans/post"
        >
          /v1/scans
        </a>
      </div>
      <ApiDocsPanel
        openapiUrl="/openapi.json"
        mode="swagger"
        links={[
          { label: "OpenAPI JSON", href: "/openapi.json" },
          { label: "MCP Console", href: "/developer/mcp-console" },
          { label: "A2A Console", href: "/developer/a2a-console" },
        ]}
        mcpTools={tools}
        a2aSkills={skills}
      />
    </div>
  );
}
