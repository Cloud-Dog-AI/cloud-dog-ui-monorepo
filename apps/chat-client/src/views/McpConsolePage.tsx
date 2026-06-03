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
import { Badge, McpConsole, Card, CardContent, CardHeader } from "@cloud-dog/ui";
import { useConfig } from "@cloud-dog/config";
import { useAppState } from "../state/AppState";

type RuntimeConfig = {
  MCP_BASE_URL: string;
  API_KEY_HEADER?: string;
  AUTH_MODE?: "cookie" | "api_key" | "oidc";
};

type RpcTool = { name: string; description?: string; inputSchema?: unknown };

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const { apiKey, apiKeyHeader } = useAppState();
  const [tools, setTools] = React.useState<RpcTool[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const rpcHeaders = React.useMemo(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey.trim()) headers[apiKeyHeader || cfg.API_KEY_HEADER || "X-API-Key"] = apiKey.trim();
    return headers;
  }, [apiKey, apiKeyHeader, cfg.API_KEY_HEADER]);

  const callRpc = React.useCallback(async (method: string, params: Record<string, unknown> = {}) => {
    const response = await fetch(cfg.MCP_BASE_URL, {
      method: "POST",
      credentials: "include",
      headers: rpcHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(String(payload?.error?.message || response.statusText || "MCP request failed"));
    }
    return payload.result;
  }, [cfg.MCP_BASE_URL, rpcHeaders]);

  const loadTools = React.useCallback(async () => {
    setError(null);
    try {
      const result = await callRpc("tools/list");
      setTools(Array.isArray(result?.tools) ? result.tools : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MCP tools");
      setTools([]);
    }
  }, [callRpc]);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const authMode = cfg.AUTH_MODE ?? (apiKey.trim() ? "api_key" : "cookie");

  return (
    <div className="space-y-6">
      {/* PS-72 MW4: Auth display */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Authentication</h2>
            <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">{authMode}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            MCP endpoint: <code className="text-xs">{cfg.MCP_BASE_URL}</code>
            {authMode === "api_key" ? ` — Key header: ${apiKeyHeader || cfg.API_KEY_HEADER || "X-API-Key"}` : " — Session cookie auth"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">MCP Console</h1>
          <p className="text-sm text-muted-foreground">Test the chat-client MCP surface through the shared console component.</p>
        </CardHeader>
        <CardContent className="space-y-3">
        <McpConsole
          endpointUrl={cfg.MCP_BASE_URL}
          tools={tools}
          onExecute={(toolName, args) => callRpc("tools/call", { name: toolName, arguments: args })}
        />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
    </div>
  );
}
