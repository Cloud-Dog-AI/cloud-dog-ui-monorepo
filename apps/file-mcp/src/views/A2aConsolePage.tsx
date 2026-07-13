// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// @cloud-dog/app-file-mcp - PS-72 A2A console page.

import * as React from "react";
import { Card, CardContent, CardHeader, Ps72A2aConsole, Spinner, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";

function boundKeyLabel(authMode: "api_key" | "cookie" | "oidc", apiKey: string): string {
  if (authMode === "cookie") return "session cookie";
  const trimmed = apiKey.trim();
  return trimmed ? `****${trimmed.slice(-4)}` : "not bound";
}

function skillNames(agentCard: Record<string, unknown> | null): string[] {
  const rawSkills = Array.isArray(agentCard?.skills) ? (agentCard?.skills as Array<Record<string, unknown>>) : [];
  return rawSkills.map((skill) => String(skill.id ?? skill.name ?? "").trim()).filter(Boolean);
}

function healthState(agentCard: Record<string, unknown> | null, healthPayload: Record<string, unknown> | null): Ps72HealthState {
  const status = String(healthPayload?.status ?? healthPayload?.health ?? "").toLowerCase();
  if (status === "healthy" || status === "degraded" || status === "unhealthy") return status;
  return agentCard ? "healthy" : "unknown";
}

function taskInputText(action: string, payload: unknown): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if ("tool" in record || "arguments" in record) return JSON.stringify(record);
  }
  if (action === "file-management") return JSON.stringify({ tool: "list_dir", arguments: { path: "." } });
  return typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
}

function serviceBase(apiBaseUrl: string): string {
  const cleaned = apiBaseUrl.replace(/\/+$/, "");
  if (cleaned.endsWith("/api")) {
    return cleaned.slice(0, -4) || window.location.origin;
  }
  return cleaned || window.location.origin;
}

export function A2aConsolePage() {
  const { api, apiKey, apiBaseUrl, a2aBaseUrl, authMode, selectedProfile } = useFileMcpState();
  const base = serviceBase(apiBaseUrl);
  const [healthPayload, setHealthPayload] = React.useState<Record<string, unknown> | null>(null);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true); setError(null);
    void Promise.all([
      api.getA2aHealth().then((payload) => setHealthPayload(payload as Record<string, unknown>)).catch(() => undefined),
      fetch(`${base}/.well-known/agent.json`, { credentials: "include" }).then((response) => response.ok ? response.json() : null).then((card) => setAgentCard(card as Record<string, unknown> | null)).catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, [api, base]);

  const sendTask = React.useCallback(async (action: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
    const correlationId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const selectedKey = overrideKey.trim() || apiKey.trim();
    const response = await fetch(`${a2aBaseUrl}/tasks`, {
      method: "POST",
      credentials: authMode === "cookie" ? "include" : "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Session-ID": correlationId,
        ...(selectedProfile ? { "X-File-MCP-Profile": selectedProfile } : {}),
        ...(authMode !== "cookie" && selectedKey ? { Authorization: `Bearer ${selectedKey}` } : {}),
      },
      body: JSON.stringify({ id: correlationId, skill_id: action, input: { text: taskInputText(action, payload) } }),
    });
    const body = await response.json().catch(() => ({ error: "A2A task response was not valid JSON.", httpStatus: response.status }));
    return { body, correlationId, requestId, httpStatus: response.status, denied: !response.ok || response.status === 403 };
  }, [a2aBaseUrl, apiKey, authMode, selectedProfile]);

  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">A2A Console</h1></header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Execution context</h2></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span>Auth: <strong>{authMode === "cookie" ? "Session cookie" : "API key"}</strong></span>
            <span>Profile: <strong>{selectedProfile}</strong></span>
            <a className="text-sm font-medium text-sky-700 hover:underline" href="/developer/api-docs#a2a">View A2A documentation</a>
          </div>
          <p className="text-xs text-muted-foreground break-all"><span className="font-semibold text-foreground">A2A base: </span><code>{a2aBaseUrl}</code></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">A2A message console</h2></CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite"><Spinner className="h-5 w-5" />Loading A2A console...</div> : (
            <Ps72A2aConsole endpointUrl={a2aBaseUrl} agentCard={agentCard} skills={skillNames(agentCard)} health={healthState(agentCard, healthPayload)} hasBoundKey={authMode === "cookie" || Boolean(apiKey.trim())} boundLabel={boundKeyLabel(authMode, apiKey)} docsHref="/developer/api-docs#a2a" jobsHref="/system/jobs" onSend={sendTask} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
