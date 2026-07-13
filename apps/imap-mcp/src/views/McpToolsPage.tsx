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

// @cloud-dog/app-imap-mcp — PS-72 MCP console: ToolBrowser + shared McpConsole only.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import {
  Card,
  CardContent,
  CardHeader,
  Ps72McpConsole,
  Spinner,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";
import type { CallResult, JsonRecord, ToolDescriptor } from "../lib/types";

type RuntimeConfig = Readonly<{
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  UI_BASE_PATH?: string;
}>;

function uiHref(basePath: string | undefined, path: string): string {
  const base = (basePath ?? "/ui").replace(/\/+$/, "");
  const target = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${target}` : target;
}

function toPs72Tool(tool: ToolDescriptor): Ps72McpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
    bound: true,
  };
}

function boundKeyLabel(authMode: "api_key" | "cookie" | "oidc", authenticated: boolean, apiKey: string): string {
  if (authMode === "cookie" || authMode === "oidc") return authenticated ? "session" : "not signed in";
  const trimmed = apiKey.trim();
  return trimmed ? `••••${trimmed.slice(-4)}` : "no bound key";
}

function extractJobId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const root = body as Record<string, unknown>;
  const result = root.result && typeof root.result === "object" && !Array.isArray(root.result)
    ? (root.result as Record<string, unknown>)
    : root;
  const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? (result.data as Record<string, unknown>)
    : null;
  const candidate = result.job_id ?? result.jobId ?? result.job ?? data?.job_id ?? data?.jobId;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function toPs72Result<T>(result: CallResult<T>): Ps72ExecuteResult {
  const body = result.ok
    ? (result.data ?? result.raw)
    : { error: result.errorMessage, error_code: result.errorCode, httpStatus: result.meta.status, details: result.raw };
  return {
    body,
    correlationId: result.meta.correlationId,
    requestId: result.meta.requestId,
    httpStatus: result.meta.status,
    denied: !result.ok || result.meta.status === 403,
    jobId: extractJobId(body),
  };
}

export function McpToolsPage() {
  const auth = useAuth();
  const cfg = useConfig<RuntimeConfig>();
  const { api, apiKey, mcpBaseUrl } = useImapMcpState();
  const authMode = cfg.AUTH_MODE ?? "cookie";
  const [mcpDefs, setMcpDefs] = React.useState<Ps72McpTool[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  const consoleKey = React.useMemo(() => mcpDefs.map((t) => t.name).join("|") || "empty", [mcpDefs]);

  const loadTools = React.useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await api.listMcpTools();
    if (!result.ok || !result.data) {
      setError(result.errorMessage || "Failed to load MCP tools.");
      setMcpDefs([]);
      setHealth("unhealthy");
      setLoading(false);
      return;
    }
    const defs = result.data.map(toPs72Tool);
    setMcpDefs(defs);
    setHealth(defs.length > 0 ? "healthy" : "degraded");
    setLoading(false);
  }, [api]);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const endpointUrl = `${mcpBaseUrl.replace(/\/$/, "")}/webmcp/tools`;
  const hasBoundKey = authMode === "cookie" || authMode === "oidc" ? auth.isAuthenticated : Boolean(apiKey.trim());
  const currentBoundLabel = boundKeyLabel(authMode, auth.isAuthenticated, apiKey);

  const executeTool = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const payload = args && typeof args === "object" && !Array.isArray(args) ? (args as JsonRecord) : {};
      const result = await api.callMcpTool<unknown>(toolName, payload, overrideKey);
      return toPs72Result(result);
    },
    [api],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">MCP Console</h1>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">MCP tool execution</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />
              Loading tools…
            </div>
          ) : mcpDefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCP tools registered for this server.</p>
          ) : (
            <Ps72McpConsole
              key={consoleKey}
              endpointUrl={endpointUrl}
              tools={mcpDefs}
              health={health}
              hasBoundKey={hasBoundKey}
              boundLabel={currentBoundLabel}
              docsHref={uiHref(cfg.UI_BASE_PATH, "/api-docs#mcp")}
              jobsHref={uiHref(cfg.UI_BASE_PATH, "/jobs")}
              onExecute={executeTool}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
