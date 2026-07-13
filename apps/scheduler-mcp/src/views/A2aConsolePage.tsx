// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1404d — PS-72 v2 canonical A2A console (replaces P3 stub).

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Ps72A2aConsole,
  Spinner,
  type Ps72ExecuteResult,
  type Ps72HealthState,
} from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";
import { useAppState } from "../state/AppState";
import { PageHeader } from "../lib/ui";

// W28K-1408 F-1408-5 — bound every A2A fetch to a 10s timeout so a slow adapter
// cannot hang the console; transport/timeout failures surface as a displayed error.
const A2A_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function boundLabel(apiKey: string | null): string {
  if (!apiKey || !apiKey.trim()) return "session cookie";
  const t = apiKey.trim();
  return t.length <= 4 ? "****" : `****${t.slice(-4)}`;
}

function skillNames(card: Record<string, unknown> | null): string[] {
  const raw = Array.isArray(card?.skills) ? (card?.skills as Array<Record<string, unknown>>) : [];
  return raw.map((s) => String(s.id ?? s.name ?? "").trim()).filter(Boolean);
}

function healthState(
  card: Record<string, unknown> | null,
  healthPayload: Record<string, unknown> | null,
): Ps72HealthState {
  const status = String(healthPayload?.status ?? healthPayload?.health ?? "").toLowerCase();
  if (status === "healthy" || status === "degraded" || status === "unhealthy") {
    return status as Ps72HealthState;
  }
  return card ? "healthy" : "unknown";
}

function taskInputText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") return JSON.stringify(payload);
  return JSON.stringify(payload ?? {});
}

export function A2aConsolePage() {
  const { a2aBaseUrl } = useAppState();
  const auth = useAuth();
  const apiKey = auth.getAccessToken?.() ?? null;

  const [healthPayload, setHealthPayload] = React.useState<Record<string, unknown> | null>(null);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    const credentials: RequestCredentials = "include";
    const headers: HeadersInit = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    void Promise.all([
      fetchWithTimeout(`${a2aBaseUrl}/health`, { credentials, headers }, A2A_TIMEOUT_MS)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => setHealthPayload(p as Record<string, unknown> | null))
        .catch(() => undefined),
      fetchWithTimeout(`${a2aBaseUrl}/.well-known/agent.json`, { credentials, headers }, A2A_TIMEOUT_MS)
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => setAgentCard(c as Record<string, unknown> | null))
        .catch(() => undefined),
    ])
      .catch((e: any) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [a2aBaseUrl, apiKey]);

  const sendTask = React.useCallback(
    async (action: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const correlationId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const selectedKey = (overrideKey.trim() || apiKey || "").trim();
      // Scheduler-mcp A2A surface: POST /a2a/skills/{skill_id} with body
      // {input: <payload>, correlation_id: <uuid>}.
      const inputObj = payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : { text: taskInputText(payload) };
      // Transport guard: 10s timeout + transport-failure recovery -> displayed error.
      let resp: Response;
      try {
        resp = await fetchWithTimeout(`${a2aBaseUrl}/skills/${encodeURIComponent(action)}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
            "X-Session-ID": correlationId,
            ...(selectedKey ? { Authorization: `Bearer ${selectedKey}` } : {}),
          },
          body: JSON.stringify({ input: inputObj, correlation_id: correlationId }),
        }, A2A_TIMEOUT_MS);
      } catch (e: any) {
        const msg = e?.name === "AbortError"
          ? `A2A task timed out after ${A2A_TIMEOUT_MS / 1000}s.`
          : `A2A transport error: ${e?.message ?? String(e)}`;
        setError(msg);
        return { body: { error: msg }, correlationId, requestId, httpStatus: 0, denied: true };
      }
      // Malformed-JSON recovery (catch + display) — the adapter may return non-JSON.
      const body = await resp.json().catch(() => ({
        error: "A2A task response was not valid JSON.",
        httpStatus: resp.status,
      }));
      if (body && typeof body === "object" && "error" in body && resp.ok) {
        setError(String((body as Record<string, unknown>).error));
      } else {
        setError(null);
      }
      return {
        body,
        correlationId,
        requestId,
        httpStatus: resp.status,
        denied: !resp.ok || resp.status === 403,
      };
    },
    [a2aBaseUrl, apiKey],
  );

  return (
    <div className="space-y-6 p-6" data-testid="scheduler-a2a-console-page">
      <PageHeader title="A2A Console" description="Agent card discovery + skill execution (PS-72 v2)" />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Execution context</h2></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span>Auth: <strong>{apiKey ? "API key" : "Session cookie"}</strong></span>
            <a className="text-sm font-medium text-sky-700 hover:underline" href="/developer/api-docs#a2a">View A2A documentation</a>
          </div>
          <p className="text-xs text-muted-foreground break-all"><span className="font-semibold text-foreground">A2A base: </span><code>{a2aBaseUrl}</code></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">A2A message console</h2></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />Loading A2A console...
            </div>
          ) : (
            <Ps72A2aConsole
              endpointUrl={a2aBaseUrl}
              agentCard={agentCard}
              skills={skillNames(agentCard)}
              health={healthState(agentCard, healthPayload)}
              hasBoundKey={Boolean(apiKey)}
              boundLabel={boundLabel(apiKey)}
              docsHref="/developer/api-docs#a2a"
              jobsHref="/system/jobs"
              onSend={sendTask}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
