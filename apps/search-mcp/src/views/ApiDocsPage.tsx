// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { ApiDocsPanel, Spinner } from "@cloud-dog/ui";
import { useSearchState } from "../state/AppState";
import { PageHeader } from "../lib/ui";
import type { A2aAgentCardResponse, McpToolListResponse } from "../lib/types";

type ToolDoc = { name: string; description: string; parameters?: unknown };
type SkillDoc = { name: string; description: string; inputSchema?: unknown };

function countOps(doc: Record<string, unknown>): number {
  const paths = (doc?.paths ?? {}) as Record<string, Record<string, unknown>>;
  let n = 0;
  for (const item of Object.values(paths)) for (const m of Object.keys(item ?? {})) if (["get","post","put","patch","delete"].includes(m)) n++;
  return n;
}
function normaliseTools(raw: McpToolListResponse): ToolDoc[] {
  const list = Array.isArray(raw.tools) ? raw.tools : Array.isArray(raw.items) ? raw.items : [];
  return list.map((i) => { const r = (i ?? {}) as Record<string, unknown>; return { name: String(r.name ?? ""), description: String(r.description ?? ""), parameters: r.inputSchema ?? r.input_schema }; }).filter((r) => r.name);
}
function normaliseSkills(raw: A2aAgentCardResponse): SkillDoc[] {
  const list = Array.isArray(raw.skills) ? raw.skills : [];
  return list.map((i) => { const r = (i ?? {}) as Record<string, unknown>; return { name: String(r.id ?? r.name ?? ""), description: String(r.description ?? ""), inputSchema: r.input ?? r.input_schema ?? r.inputSchema }; }).filter((r) => r.name);
}

export function ApiDocsPage() {
  const { api, appVersion } = useSearchState();
  const [tools, setTools] = React.useState<ToolDoc[]>([]);
  const [skills, setSkills] = React.useState<SkillDoc[]>([]);
  const [ops, setOps] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let c = false; setLoading(true);
    void (async () => {
      try {
        const [openapi, toolData, card] = await Promise.all([api.openapi(), api.mcpTools(), api.a2aAgentCard()]);
        if (!c) { setOps(countOps(openapi as Record<string, unknown>)); setTools(normaliseTools(toolData)); setSkills(normaliseSkills(card)); }
      } catch { if (!c) { setOps(0); setTools([]); setSkills([]); } }
      if (!c) setLoading(false);
    })();
    return () => { c = true; };
  }, [api]);
  return (
    <div className="space-y-6">
      <PageHeader title="API Docs" version={appVersion} description="Live OpenAPI, MCP tool, and A2A skill documentation." />
      {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Spinner className="h-4 w-4" /> Loading live API catalogues…</div> : null}
      <div className="flex flex-wrap items-center gap-3 rounded border bg-muted/20 px-3 py-2 text-sm">
        <span data-testid="api-docs-operation-count" className="font-semibold">OpenAPI operations: {ops}</span>
      </div>
      <ApiDocsPanel openapiUrl="/openapi.json" mode="swagger"
        links={[{ label: "OpenAPI JSON", href: "/openapi.json" }, { label: "MCP Console", href: "/developer/mcp-console" }, { label: "A2A Console", href: "/developer/a2a-console" }]}
        mcpTools={tools} a2aSkills={skills} />
    </div>
  );
}
