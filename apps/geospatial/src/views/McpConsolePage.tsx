// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// MCP console (PS-72 v2) via the shared Ps72McpConsole. geospatial-mcp exposes a JSON-RPC
// MCP surface at /mcp (proxied by the web tier, cookie -> api-key bridge).

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Ps72McpConsole, type Ps72ExecuteResult, type Ps72HealthState, type Ps72McpTool } from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";

type RawTool = Readonly<{ name: string; description?: string; input_schema?: unknown; inputSchema?: unknown; bound?: boolean }>;

export function McpConsolePage() {
  const auth = useAuth();
  const { api } = useGeoState();
  const rpcUrl = `${window.location.origin}/mcp`;

  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = (await api.mcpTools()) as { tools?: RawTool[] };
        const list: Ps72McpTool[] = (data.tools ?? []).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema ?? t.input_schema,
          bound: t.bound,
        }));
        if (!cancelled) { setTools(list); setHealth(list.length > 0 ? "healthy" : "degraded"); }
      } catch {
        if (!cancelled) { setTools([]); setHealth("unhealthy"); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [api]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown): Promise<Ps72ExecuteResult> => {
      const res = await api.mcpCall(toolName, args);
      const body = res.body;
      const result = body && typeof body === "object" ? (body as Record<string, unknown>).result : null;
      const structured = result && typeof result === "object" ? (result as Record<string, unknown>).structuredContent : null;
      const jobId =
        structured && typeof structured === "object" && typeof (structured as Record<string, unknown>).job_id === "string"
          ? ((structured as Record<string, unknown>).job_id as string)
          : null;
      return {
        body,
        correlationId: res.correlationId,
        requestId: res.requestId,
        httpStatus: res.httpStatus,
        denied: res.denied,
        jobId,
      };
    },
    [api],
  );

  return (
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
  );
}
