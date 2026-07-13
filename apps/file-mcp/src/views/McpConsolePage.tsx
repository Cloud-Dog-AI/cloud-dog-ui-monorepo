// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// @cloud-dog/app-file-mcp - PS-72 MCP console page.

import * as React from "react";
import { Card, CardContent, CardHeader, Ps72McpConsole, Spinner, type Ps72ExecuteResult, type Ps72McpTool } from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";

const MCP_ACCEPT_HEADER = "application/json, text/event-stream";

function boundKeyLabel(authMode: "api_key" | "cookie" | "oidc", apiKey: string): string {
  if (authMode === "cookie") return "session cookie";
  const trimmed = apiKey.trim();
  return trimmed ? `****${trimmed.slice(-4)}` : "not bound";
}

function parseSseEnvelope(raw: string): Record<string, unknown> {
  const envelopes: Record<string, unknown>[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    envelopes.push(JSON.parse(payload) as Record<string, unknown>);
  }
  if (!envelopes.length) throw new Error("MCP response did not contain a JSON SSE frame.");
  return envelopes[envelopes.length - 1];
}

function parseEnvelope(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) return parseSseEnvelope(raw);
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function parseTextPayload(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

function structuredContent(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const record = result as Record<string, unknown>;
  if ("structuredContent" in record) return record.structuredContent;
  const content = record.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const text = (first as Record<string, unknown>).text;
      if (typeof text === "string") return parseTextPayload(text);
    }
  }
  return result;
}

export function McpConsolePage() {
  const { api, apiKey, mcpBaseUrl, authMode, selectedProfile } = useFileMcpState();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const consoleKey = React.useMemo(() => tools.map((tool) => tool.name).join("|") || "empty", [tools]);

  React.useEffect(() => {
    setLoading(true); setError(null);
    void api.listTools().then((result) => {
      setTools(result.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.input_schema ?? {}, bound: true })));
    }).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tools.");
    }).finally(() => setLoading(false));
  }, [api]);

  const executeTool = React.useCallback(async (toolName: string, args: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
    const correlationId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const selectedKey = overrideKey.trim() || apiKey.trim();
    const response = await fetch(mcpBaseUrl, {
      method: "POST",
      credentials: authMode === "cookie" ? "include" : "same-origin",
      headers: {
        Accept: MCP_ACCEPT_HEADER,
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Session-ID": correlationId,
        ...(selectedProfile ? { "X-File-MCP-Profile": selectedProfile } : {}),
        ...(authMode !== "cookie" && selectedKey ? { Authorization: `Bearer ${selectedKey}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method: "tools/call", params: { name: toolName, arguments: args } }),
    });
    const parsed = parseEnvelope(await response.text());
    const errorPayload = parsed.error;
    const errorMessage = errorPayload && typeof errorPayload === "object" && !Array.isArray(errorPayload)
      ? String((errorPayload as Record<string, unknown>).message ?? "MCP tool call failed.")
      : "";
    let denied = !response.ok || response.status === 403 || /denied|forbidden|permission|unauthor/i.test(errorMessage);
    let body = errorPayload && typeof errorPayload === "object" && !Array.isArray(errorPayload)
      ? { error: denied ? `Forbidden: ${errorMessage}` : errorMessage, httpStatus: response.status }
      : structuredContent(parsed.result);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const resultError = typeof (body as Record<string, unknown>).error === "string" ? String((body as Record<string, unknown>).error) : "";
      if (/denied|forbidden|permission|unauthor/i.test(resultError)) {
        denied = true;
        body = { ...(body as Record<string, unknown>), error: `Forbidden: ${resultError}` };
      }
    }
    return { body, correlationId, requestId, httpStatus: response.status, denied };
  }, [apiKey, authMode, mcpBaseUrl, selectedProfile]);

  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">MCP Console</h1></header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Execution context</h2></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span>Auth: <strong>{authMode === "cookie" ? "Session cookie" : "API key"}</strong></span>
            <span>Profile: <strong>{selectedProfile}</strong></span>
            <a className="text-sm font-medium text-sky-700 hover:underline" href="/developer/api-docs#mcp">View API documentation</a>
          </div>
          <p className="text-xs text-muted-foreground break-all"><span className="font-semibold text-foreground">MCP JSON-RPC: </span><code>{`${mcpBaseUrl}/messages`}</code></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">MCP tool execution</h2></CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite"><Spinner className="h-5 w-5" />Loading MCP tools...</div> : (
            <Ps72McpConsole key={consoleKey} endpointUrl={`${mcpBaseUrl}/messages`} tools={tools} health={error ? "unhealthy" : "healthy"} hasBoundKey={authMode === "cookie" || Boolean(apiKey.trim())} boundLabel={boundKeyLabel(authMode, apiKey)} docsHref="/developer/api-docs#mcp" jobsHref="/system/jobs" onExecute={executeTool} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
