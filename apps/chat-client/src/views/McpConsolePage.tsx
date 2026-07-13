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

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import {
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useConfig } from "../lib/runtime-config";
import { useAppState } from "../state/AppState";

type RuntimeConfig = {
  MCP_BASE_URL: string;
  AUTH_MODE?: "cookie" | "api_key" | "oidc";
};

type RpcTool = { name: string; description?: string; inputSchema?: unknown; input_schema?: unknown; bound?: boolean };
type RpcPayload = { id?: string | number; result?: { tools?: RpcTool[] } | unknown; error?: { message?: string } | unknown };

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const { apiKey, apiKeyHeader } = useAppState();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");
  const [error, setError] = React.useState<string | null>(null);

  const rpcHeaders = React.useCallback((overrideKey?: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = overrideKey?.trim() || apiKey.trim();
    if (key) headers[apiKeyHeader || "X-API-Key"] = key;
    return headers;
  }, [apiKey, apiKeyHeader]);

  const callRpc = React.useCallback(async (method: string, params: Record<string, unknown> = {}, overrideKey?: string) => {
    const response = await fetch(cfg.MCP_BASE_URL, {
      method: "POST",
      credentials: "include",
      headers: rpcHeaders(overrideKey),
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    const payload = await response.json().catch(() => ({ error: { message: "Invalid JSON response" } })) as RpcPayload;
    return { response, payload };
  }, [cfg.MCP_BASE_URL, rpcHeaders]);

  const loadTools = React.useCallback(async () => {
    setError(null);
    try {
      const { response, payload } = await callRpc("tools/list");
      if (!response.ok || payload.error) {
        throw new Error(String((payload.error as { message?: string } | undefined)?.message || response.statusText || "MCP request failed"));
      }
      const result = payload.result as { tools?: RpcTool[] } | undefined;
      const list = Array.isArray(result?.tools) ? result.tools : [];
      setTools(list.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ?? tool.input_schema,
        bound: tool.bound,
      })));
      setHealth(list.length > 0 ? "healthy" : "degraded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MCP tools");
      setTools([]);
      setHealth("unhealthy");
    }
  }, [callRpc]);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const authMode = cfg.AUTH_MODE ?? (apiKey.trim() ? "api_key" : "cookie");
  const hasBoundKey = authMode === "api_key" ? Boolean(apiKey.trim()) : auth.isAuthenticated;
  const boundLabel = authMode === "api_key"
    ? apiKey.trim() ? `••••${apiKey.trim().slice(-4)}` : "no bound key"
    : auth.isAuthenticated ? "session • cookie" : "not signed in";

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Ps72McpConsole
        endpointUrl={cfg.MCP_BASE_URL}
        tools={tools}
        health={health}
        hasBoundKey={hasBoundKey}
        boundLabel={boundLabel}
        docsHref="/api-docs"
        jobsHref="/jobs"
        onExecute={async (toolName, args, overrideKey): Promise<Ps72ExecuteResult> => {
          const { response, payload } = await callRpc("tools/call", { name: toolName, arguments: args }, overrideKey);
          const denied = !response.ok || Boolean(payload.error);
          return {
            body: payload,
            correlationId: response.headers.get("X-Correlation-Id") ?? response.headers.get("x-correlation-id"),
            requestId: response.headers.get("X-Request-Id") ?? response.headers.get("x-request-id") ?? (payload.id ? String(payload.id) : null),
            httpStatus: response.status,
            denied,
          };
        }}
      />
    </div>
  );
}
