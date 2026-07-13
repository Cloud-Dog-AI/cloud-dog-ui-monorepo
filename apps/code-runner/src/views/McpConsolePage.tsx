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

// @cloud-dog/app-code-runner — MCP console (PS-72 v2 conformant via shared Ps72McpConsole, W28A-773).

import * as React from "react";
import { ApiError } from "@cloud-dog/api-client";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import {
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useCodeRunnerState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  AUTH_MODE?: string;
  API_KEY_HEADER?: string;
}>;

type RawTool = Readonly<{
  name: string;
  description?: string;
  input_schema?: unknown;
  inputSchema?: unknown;
  bound?: boolean;
}>;

type ToolsResponse = Readonly<{
  tools?: RawTool[];
  data?: RawTool[] | { items?: RawTool[] };
  result?: { tools?: RawTool[] };
}>;

function toPs72Tools(raw: RawTool[]): Ps72McpTool[] {
  return raw.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema ?? t.input_schema,
    bound: t.bound,
  }));
}

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const { api, apiKey } = useCodeRunnerState();
  const apiKeyHeader = cfg.API_KEY_HEADER ?? "X-API-Key";
  const mcpBaseUrl = (cfg.MCP_BASE_URL ?? cfg.API_BASE_URL).replace(/\/$/, "");
  const authMode = cfg.AUTH_MODE ?? "api_key";

  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  const headers = React.useCallback(
    (extra?: Record<string, string>, overrideKey?: string): Record<string, string> => {
      const out: Record<string, string> = { Accept: "application/json", ...extra };
      const key = (overrideKey && overrideKey.trim()) || apiKey;
      if (key && key.trim()) out[apiKeyHeader] = key.trim();
      return out;
    },
    [apiKey, apiKeyHeader],
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.request<ToolsResponse>("/webmcp/tools", { headers: headers() });
        const arr = Array.isArray(data.data) ? data.data : (data.data?.items ?? data.tools ?? data.result?.tools ?? []);
        const list = toPs72Tools(arr ?? []);
        if (!cancelled) { setTools(list); setHealth(list.length > 0 ? "healthy" : "degraded"); }
      } catch {
        if (!cancelled) { setTools([]); setHealth("unhealthy"); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [api, headers, mcpBaseUrl]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      try {
        const body: unknown = await api.request(`/webmcp/tools/${encodeURIComponent(toolName)}`, {
          method: "POST",
          headers: headers(undefined, overrideKey),
          body: args,
        });
        // code-runner job tools return the Job ID under data.job_id or data.proof.job_id.
        const data = (body && typeof body === "object" ? (body as Record<string, unknown>).data : null) as
          | Record<string, unknown>
          | null;
        const proof = (data && typeof data.proof === "object" ? (data.proof as Record<string, unknown>) : null);
        const jobId =
          (data && typeof data.job_id === "string" ? data.job_id : null) ??
          (proof && typeof proof.job_id === "string" ? proof.job_id : null);
        return { body, correlationId: null, requestId: null, httpStatus: 200, denied: false, jobId };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            body: error.options.details ?? { error: error.message },
            correlationId: error.options.correlationId ?? null,
            requestId: error.options.requestId ?? null,
            httpStatus: error.options.status,
            denied: true,
          };
        }
        throw error;
      }
    },
    [api, headers],
  );

  const hasBoundKey = authMode === "cookie" ? auth.isAuthenticated : Boolean(apiKey && apiKey.trim());
  const boundLabel =
    authMode === "cookie"
      ? auth.isAuthenticated
        ? "session • cookie"
        : "not signed in"
      : apiKey && apiKey.trim()
        ? `••••${apiKey.trim().slice(-4)}`
        : "no bound key";

  return (
    <Ps72McpConsole
      endpointUrl={`${mcpBaseUrl}/webmcp/tools`}
      tools={tools}
      health={health}
      hasBoundKey={hasBoundKey}
      boundLabel={boundLabel}
      docsHref="/developer/api-docs"
      jobsHref="/system/jobs"
      onExecute={onExecute}
    />
  );
}
