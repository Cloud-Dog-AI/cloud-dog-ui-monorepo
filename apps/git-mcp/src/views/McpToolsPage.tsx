import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import {
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { ToolCallOutcome } from "../lib/types";

type RuntimeConfig = Readonly<{
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  MCP_BASE_URL: string;
}>;

function toPs72Tool(tool: { name: string; description?: string; input_schema?: Record<string, unknown> }): Ps72McpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
    bound: true,
  };
}

function extractJobId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
  const candidate = record.job_id ?? record.jobId ?? nested?.job_id ?? nested?.jobId;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function toPs72Result(outcome: ToolCallOutcome): Ps72ExecuteResult {
  return {
    body: outcome.ok ? outcome.data : { error: outcome.errorMessage, details: outcome.data },
    correlationId: outcome.meta.correlationId,
    requestId: outcome.meta.requestId,
    httpStatus: outcome.meta.status,
    denied: !outcome.ok,
    jobId: extractJobId(outcome.data),
  };
}

export function McpToolsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const app = useGitMcpState();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  const refresh = React.useCallback(async () => {
    try {
      const nextTools = await app.api.listMcpTools(app.apiKey);
      const mapped = nextTools.map(toPs72Tool);
      setTools(mapped);
      setHealth(mapped.length > 0 ? "healthy" : "degraded");
    } catch (loadError) {
      setTools([]);
      setHealth("unhealthy");
    }
  }, [app.api, app.apiKey]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const payload = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
      const key = overrideKey.trim() || app.apiKey;
      const outcome = await app.api.callMcpTool(key, toolName, payload);
      return toPs72Result(outcome);
    },
    [app.api, app.apiKey],
  );

  const authMode = cfg.AUTH_MODE ?? "api_key";
  const hasBoundKey = authMode === "cookie" || authMode === "oidc" ? auth.isAuthenticated : Boolean(app.apiKey.trim());
  const boundLabel =
    authMode === "cookie" || authMode === "oidc"
      ? auth.isAuthenticated
        ? "session"
        : "not signed in"
      : app.apiKey.trim()
        ? `••••${app.apiKey.trim().slice(-4)}`
        : "no bound key";

  return (
    <Ps72McpConsole
      endpointUrl={`${cfg.MCP_BASE_URL.replace(/\/$/, "")}/mcp/tools`}
      tools={tools}
      health={health}
      hasBoundKey={hasBoundKey}
      boundLabel={boundLabel}
      docsHref="/api-docs"
      jobsHref="/jobs"
      onExecute={onExecute}
    />
  );
}
