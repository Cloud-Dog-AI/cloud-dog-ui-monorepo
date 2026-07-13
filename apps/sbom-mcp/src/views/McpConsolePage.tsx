// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

// MCP console (PS-72 v2) via the shared Ps72McpConsole. sbom-mcp exposes a JSON-RPC
// MCP surface at /mcp (proxied by the web tier, cookie -> api-key bridge).

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import {
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import type { McpToolListResponse, McpToolResponse } from "../lib/types";

function toolsFromResponse(data: McpToolListResponse): McpToolResponse[] {
  if (Array.isArray(data.tools)) return data.tools;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && typeof data.data === "object" && Array.isArray(data.data.items)) return data.data.items;
  return data.result?.tools ?? [];
}

export function McpConsolePage() {
  const auth = useAuth();
  const { api } = useSbomState();
  const origin = window.location.origin;
  const rpcUrl = `${origin}/mcp/tools/call`;

  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");
  const [lastCurl, setLastCurl] = React.useState("");
  const [lastResponse, setLastResponse] = React.useState<unknown | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await api.mcpHealth();
        const data = await api.mcpTools();
        const list: Ps72McpTool[] = toolsFromResponse(data).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema ?? t.input_schema,
          bound: t.bound,
        }));
        if (!cancelled) {
          setTools(list);
          setHealth(list.length > 0 ? "healthy" : "degraded");
        }
      } catch {
        if (!cancelled) {
          setTools([]);
          setHealth("unhealthy");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown): Promise<Ps72ExecuteResult> => {
      const body = { name: toolName, arguments: args };
      setLastCurl(`curl -sk -X POST ${rpcUrl} -H "Content-Type: application/json" -d '${JSON.stringify(body)}'`);
      const result = await api.mcpCall(toolName, args);
      setLastResponse(result.body);
      return result;
    },
    [api, rpcUrl]
  );

  const copyCurl = React.useCallback(async () => {
    if (!lastCurl) return;
    await navigator.clipboard?.writeText(lastCurl);
  }, [lastCurl]);

  const downloadResponse = React.useCallback(() => {
    if (lastResponse === null) return;
    const blob = new Blob([JSON.stringify(lastResponse, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mcp-response.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [lastResponse]);

  return (
    <div className="space-y-3">
      <Ps72McpConsole
        endpointUrl={rpcUrl}
        tools={tools}
        health={health}
        hasBoundKey={auth.isAuthenticated}
        boundLabel={auth.isAuthenticated ? "session • cookie" : "not signed in"}
        docsHref="/developer/api-docs"
        jobsHref="/system/jobs"
        onExecute={onExecute}
      />
      <div className="flex flex-wrap gap-2 rounded border bg-muted/20 p-3">
        <button
          type="button"
          data-testid="mcp-console-copy-curl"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={!lastCurl}
          onClick={() => void copyCurl()}
        >
          Copy as cURL
        </button>
        <button
          type="button"
          data-testid="mcp-console-download-response"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={lastResponse === null}
          onClick={downloadResponse}
        >
          Download response
        </button>
      </div>
    </div>
  );
}
