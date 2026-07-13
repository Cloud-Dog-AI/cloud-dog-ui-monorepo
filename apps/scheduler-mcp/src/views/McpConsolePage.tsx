// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1404d — PS-72 v2 canonical MCP console (replaces P3 stub).

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Ps72McpConsole,
  Spinner,
  type Ps72ExecuteResult,
  type Ps72McpTool,
} from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";
import { useAppState } from "../state/AppState";
import { PageHeader } from "../lib/ui";
import { SSE_TIMEOUT_MS, fetchText, parseEnvelope, type FetchTextResult } from "../lib/mcp-transport";

const MCP_ACCEPT = "application/json, text/event-stream";

function boundLabel(apiKey: string | null): string {
  if (!apiKey || !apiKey.trim()) return "session cookie";
  const t = apiKey.trim();
  return t.length <= 4 ? "****" : `****${t.slice(-4)}`;
}

function structuredContent(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const rec = result as Record<string, unknown>;
  if ("structuredContent" in rec) return rec.structuredContent;
  const content = rec.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const text = (first as Record<string, unknown>).text;
      if (typeof text === "string") {
        try { return JSON.parse(text); } catch { return text; }
      }
    }
  }
  return result;
}

export function McpConsolePage() {
  const { mcpBaseUrl } = useAppState();
  const auth = useAuth();
  const apiKey = auth.getAccessToken?.() ?? null;

  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const consoleKey = React.useMemo(
    () => tools.map((t) => t.name).join("|") || "empty",
    [tools],
  );

  const listTools = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchText(mcpBaseUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: MCP_ACCEPT,
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }, SSE_TIMEOUT_MS);
      const parsed = parseEnvelope(r.text);
      const result = (parsed.result as { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> } | undefined)?.tools ?? [];
      setTools(result.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
        bound: true,
      })));
    } catch (e: any) {
      setError(e?.name === "AbortError" ? `MCP tools/list timed out after ${SSE_TIMEOUT_MS / 1000}s.` : (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }, [mcpBaseUrl, apiKey]);

  React.useEffect(() => { void listTools(); }, [listTools]);

  const executeTool = React.useCallback(
    async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const correlationId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const selectedKey = (overrideKey.trim() || apiKey || "").trim();
      // Transport guard: 10s timeout + transport-failure recovery -> displayed error.
      let resp: FetchTextResult;
      try {
        resp = await fetchText(mcpBaseUrl, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: MCP_ACCEPT,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
            "X-Session-ID": correlationId,
            ...(selectedKey ? { Authorization: `Bearer ${selectedKey}` } : {}),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            method: "tools/call",
            params: { name: toolName, arguments: args },
          }),
        }, SSE_TIMEOUT_MS);
      } catch (e: any) {
        const msg = e?.name === "AbortError"
          ? `MCP tool call timed out after ${SSE_TIMEOUT_MS / 1000}s.`
          : `MCP transport error: ${e?.message ?? String(e)}`;
        setError(msg);
        return { body: { error: msg }, correlationId, requestId, httpStatus: 0, denied: true };
      }
      // Malformed-JSON / frame-guard recovery: display + return a structured error.
      let parsed: Record<string, unknown>;
      try {
        parsed = parseEnvelope(resp.text);
      } catch (e: any) {
        const msg = e?.message ?? "Malformed MCP response.";
        setError(msg);
        return { body: { error: msg, httpStatus: resp.status }, correlationId, requestId, httpStatus: resp.status, denied: true };
      }
      setError(null);
      const errPayload = parsed.error;
      const errMsg = errPayload && typeof errPayload === "object" && !Array.isArray(errPayload)
        ? String((errPayload as Record<string, unknown>).message ?? "MCP tool call failed.")
        : "";
      let denied = !resp.ok || resp.status === 403 || /denied|forbidden|permission|unauthor/i.test(errMsg);
      let body: unknown = errPayload && typeof errPayload === "object" && !Array.isArray(errPayload)
        ? { error: denied ? `Forbidden: ${errMsg}` : errMsg, httpStatus: resp.status }
        : structuredContent((parsed as Record<string, unknown>).result);
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const re = typeof (body as Record<string, unknown>).error === "string"
          ? String((body as Record<string, unknown>).error) : "";
        if (/denied|forbidden|permission|unauthor/i.test(re)) {
          denied = true;
          body = { ...(body as Record<string, unknown>), error: `Forbidden: ${re}` };
        }
      }
      return { body, correlationId, requestId, httpStatus: resp.status, denied };
    },
    [apiKey, mcpBaseUrl],
  );

  return (
    <div className="space-y-6 p-6" data-testid="scheduler-mcp-console-page">
      <PageHeader title="MCP Console" description="Discover and execute scheduler MCP tools (PS-72 v2)" />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Execution context</h2></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span>Auth: <strong>{apiKey ? "API key" : "Session cookie"}</strong></span>
            <a className="text-sm font-medium text-sky-700 hover:underline" href="/developer/api-docs#mcp">View API documentation</a>
          </div>
          <p className="text-xs text-muted-foreground break-all"><span className="font-semibold text-foreground">MCP JSON-RPC: </span><code>{mcpBaseUrl}</code></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">MCP tool execution</h2></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />Loading MCP tools...
            </div>
          ) : (
            <Ps72McpConsole
              key={consoleKey}
              endpointUrl={mcpBaseUrl}
              tools={tools}
              health={error ? "unhealthy" : "healthy"}
              hasBoundKey={Boolean(apiKey)}
              boundLabel={boundLabel(apiKey)}
              docsHref="/developer/api-docs#mcp"
              jobsHref="/system/jobs"
              onExecute={executeTool}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
