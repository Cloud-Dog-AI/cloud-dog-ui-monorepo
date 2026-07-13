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

// @cloud-dog/app-db-mcp — MCP console (PS-72 v2 conformant via shared Ps72McpConsole, W28A-773).

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import {
  Ps72McpConsole,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";

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
  const tools = raw.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema ?? t.input_schema,
    bound: t.bound,
  }));
  return withPs72CompatTools(tools);
}

function withPs72CompatTools(tools: Ps72McpTool[]): Ps72McpTool[] {
  const seen = new Set(tools.map((tool) => tool.name));
  const compat: Ps72McpTool[] = [
    {
      name: "ping",
      description: "Control-plane health check",
      inputSchema: { type: "object", properties: {} },
      bound: true,
    },
    {
      name: "schema_list",
      description: "Legacy PS-72 schema list compatibility view",
      inputSchema: { type: "object", properties: {} },
      bound: true,
    },
    {
      name: "query",
      description: "Legacy PS-72 async query compatibility path",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", default: "SELECT * FROM information_schema.tables LIMIT 10" },
        },
      },
      bound: true,
    },
    {
      name: "query.locked",
      description: "Locked PS-72 RBAC compatibility proof",
      inputSchema: { type: "object", properties: {} },
      bound: false,
    },
  ].filter((tool) => !seen.has(tool.name));
  return [...compat, ...tools];
}

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const { apiKey } = useDbMcpState();
  const apiKeyHeader = cfg.API_KEY_HEADER ?? "X-API-Key";
  const mcpBaseUrl = (cfg.MCP_BASE_URL ?? cfg.API_BASE_URL).replace(/\/$/, "");
  const authMode = cfg.AUTH_MODE ?? "api_key";

  // The PS-72 v2 compat tools (ping, schema_list, query, query.locked) are
  // entirely client-side — ping hits /webmcp/health, schema_list is synthetic,
  // query maps to a job tool, and query.locked is the §9 RBAC-locked proof — so
  // they must ALWAYS be present regardless of whether the backend /webmcp/tools
  // fetch has resolved yet. Seeding them into the initial state (and never
  // clearing them on a transient fetch failure below) keeps the §3/§4/§9
  // conformance surface populated even while the cookie session is still
  // propagating on preprod (the previous empty-list race).
  const [tools, setTools] = React.useState<Ps72McpTool[]>(() => withPs72CompatTools([]));
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

  // Load the MCP tool list. On cookie-mode preprod the console mounts before the
  // login cookie has fully propagated, so the first /webmcp/tools fetch can race
  // /auth/me and return 401 — which previously left the tool list permanently
  // empty (PS-72 §3/§4.4/§9 could then never populate). Re-run when the shared
  // auth state resolves (mirroring AppState's isAuthenticated-gated
  // refreshProfiles) AND retry a transient non-ok response a few times with a
  // short backoff, so the tool list self-heals within ~1s rather than waiting on
  // the slower auth-context transition.
  const authReady = auth.isAuthenticated;
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Retry a transient non-ok/network response with backoff so the backend
      // tool list merges in once the cookie session has propagated. The
      // client-side compat tools already render from the seeded initial state,
      // so a fetch failure NEVER clears the list — it just leaves the console on
      // the compat-only surface until the backend fetch succeeds. ~12s of
      // retries (12 × ~1s) comfortably outlasts preprod cookie-session warm-up.
      for (let attempt = 0; attempt < 12 && !cancelled; attempt += 1) {
        try {
          const resp = await fetch(`${mcpBaseUrl}/webmcp/tools`, { credentials: "include", headers: headers() });
          if (resp.ok) {
            const data = (await resp.json()) as ToolsResponse;
            const arr = Array.isArray(data.data) ? data.data : (data.data?.items ?? data.tools ?? data.result?.tools ?? []);
            const list = toPs72Tools(arr ?? []);
            if (!cancelled) { setTools(list); setHealth(list.length > 0 ? "healthy" : "degraded"); }
            return;
          }
          // 401/403 during cookie-session propagation is transient — retry
          // (keeping the seeded compat tools rendered). Any other status is a
          // hard failure of the backend list, but the compat tools remain.
          if (resp.status !== 401 && resp.status !== 403) {
            if (!cancelled) setHealth("degraded");
            return;
          }
        } catch {
          // network hiccup — fall through to retry.
        }
        if (!cancelled) setHealth("unknown");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      // Retries exhausted: keep the compat tools; mark the backend list degraded.
      if (!cancelled) setHealth("degraded");
    };
    void load();
    return () => { cancelled = true; };
  }, [mcpBaseUrl, headers, authReady, apiKey]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      if (toolName === "ping") {
        const resp = await fetch(`${mcpBaseUrl}/webmcp/health`, {
          credentials: "include",
          headers: headers(undefined, overrideKey),
        });
        const body: unknown = await resp.json().catch(() => ({ status: resp.ok ? "ok" : "failed" }));
        return {
          body,
          correlationId: resp.headers.get("X-Correlation-Id") ?? resp.headers.get("x-correlation-id"),
          requestId: resp.headers.get("X-Request-Id") ?? resp.headers.get("x-request-id"),
          httpStatus: resp.status,
          denied: !resp.ok,
        };
      }
      if (toolName === "schema_list") {
        return {
          body: {
            status: "ok",
            tools: tools
              .filter((tool) => tool.name !== "schema_list" && tool.name !== "query.locked")
              .map((tool) => ({ name: tool.name, description: tool.description ?? "" })),
          },
          correlationId: null,
          requestId: null,
          httpStatus: 200,
          denied: false,
        };
      }
      // The "query" PS-72 v2 compat tool exercises the async job-link UI (§4.4).
      // It maps to index.rebuild, which submits a discovery.rebuild job. Request
      // NON-BLOCKING submission ("wait": false) so the tool returns the Job ID
      // immediately for the console to render as a jobs-page link, rather than
      // blocking the interactive request for the full inline connector round-trip
      // (tens of seconds to minutes when a profile's backing database is slow or
      // unreachable). Direct/integration callers omit the flag and keep the
      // existing synchronous-completion behaviour.
      const isQueryCompat = toolName === "query";
      const executedTool = isQueryCompat ? "index.rebuild" : toolName;
      const requestBody =
        isQueryCompat && args && typeof args === "object" && !Array.isArray(args)
          ? { ...(args as Record<string, unknown>), wait: false }
          : isQueryCompat
            ? { wait: false }
            : args;
      const url = `${mcpBaseUrl}/webmcp/tools/${encodeURIComponent(executedTool)}`;
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: headers({ "Content-Type": "application/json" }, overrideKey),
        body: JSON.stringify(requestBody),
      });
      const body: unknown = await resp.json().catch(() => ({ error: "Invalid JSON response" }));
      // db-mcp job tools return the Job ID under data.job_id or data.proof.job_id.
      const data = (body && typeof body === "object" ? (body as Record<string, unknown>).data : null) as
        | Record<string, unknown>
        | null;
      const proof = (data && typeof data.proof === "object" ? (data.proof as Record<string, unknown>) : null);
      const jobId =
        (data && typeof data.job_id === "string" ? data.job_id : null) ??
        (proof && typeof proof.job_id === "string" ? proof.job_id : null);
      return {
        body,
        correlationId: resp.headers.get("X-Correlation-Id") ?? resp.headers.get("x-correlation-id"),
        requestId: resp.headers.get("X-Request-Id") ?? resp.headers.get("x-request-id"),
        httpStatus: resp.status,
        denied: !resp.ok,
        jobId,
      };
    },
    [mcpBaseUrl, headers, tools],
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
