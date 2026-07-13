// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

// A2A console (PS-72 v2) via the shared Ps72A2aConsole. sbom-mcp exposes its agent
// card at /.well-known/agent-card and skill calls at /a2a/skills/call.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Ps72A2aConsole, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import type { A2aAgentCardResponse } from "../lib/types";

function extractSkills(card: A2aAgentCardResponse | null): string[] {
  const base = ["root", "health"];
  const raw = card?.skills;
  if (Array.isArray(raw)) {
    const ids = raw
      .map((s) =>
        typeof s === "string"
          ? s
          : s && typeof s === "object"
          ? String((s as Record<string, unknown>).id ?? (s as Record<string, unknown>).name ?? "")
          : ""
      )
      .filter((s) => s.trim());
    if (ids.length) return [...base, ...ids];
  }
  return [...base, "submit_scan", "get_scan_result", "list_scans"];
}

function skillTemplates(card: A2aAgentCardResponse | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const raw = card?.skills;
  if (!Array.isArray(raw)) return out;
  for (const skill of raw) {
    if (!skill || typeof skill !== "object") continue;
    const row = skill as Record<string, unknown>;
    const name = String(row.id ?? row.name ?? "");
    const input = row.input ?? row.input_schema ?? row.inputSchema;
    if (name && input && typeof input === "object") out[name] = input;
  }
  return out;
}

export function A2aConsolePage() {
  const auth = useAuth();
  const { api } = useSbomState();
  const origin = window.location.origin;
  const a2aBaseUrl = `${origin}/a2a`;

  const [agentCard, setAgentCard] = React.useState<A2aAgentCardResponse | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");
  const [lastRequest, setLastRequest] = React.useState("");
  const [lastResponse, setLastResponse] = React.useState<unknown | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void api.a2aAgentCard()
      .then((card) => {
        if (!cancelled) {
          setAgentCard(card);
        }
        return api.a2aHealth();
      })
      .then(() => {
        if (!cancelled) setHealth("healthy");
      })
      .catch(() => {
        if (!cancelled) {
          setHealth("unhealthy");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const onSend = React.useCallback(
    async (action: string, payload: unknown): Promise<Ps72ExecuteResult> => {
      const normalized = action.trim().toLowerCase();
      if (normalized === "root") {
        const body = await api.a2aAgentCard();
        const result = { body, correlationId: null, requestId: null, httpStatus: 200, denied: false };
        setLastRequest(JSON.stringify({ action, payload }, null, 2));
        setLastResponse(body);
        return result;
      }
      if (normalized === "health" || normalized === "status") {
        const body = await api.a2aHealth();
        const result = { body, correlationId: null, requestId: null, httpStatus: 200, denied: false };
        setLastRequest(JSON.stringify({ action, payload }, null, 2));
        setLastResponse(body);
        return result;
      }
      setLastRequest(JSON.stringify({ skill: action, arguments: payload }, null, 2));
      const result = await api.a2aSkillCall(action, payload);
      setLastResponse(result.body);
      return result;
    },
    [api]
  );

  const copyRequest = React.useCallback(async () => {
    if (!lastRequest) return;
    await navigator.clipboard?.writeText(lastRequest);
  }, [lastRequest]);

  const downloadResponse = React.useCallback(() => {
    if (lastResponse === null) return;
    const blob = new Blob([JSON.stringify(lastResponse, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "a2a-response.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [lastResponse]);

  return (
    <div className="space-y-3">
      <Ps72A2aConsole
        endpointUrl={a2aBaseUrl}
        agentCard={agentCard}
        skills={extractSkills(agentCard)}
        skillTemplates={skillTemplates(agentCard)}
        health={health}
        hasBoundKey={auth.isAuthenticated}
        boundLabel={auth.isAuthenticated ? "session • cookie" : "not signed in"}
        docsHref="/developer/api-docs"
        jobsHref="/system/jobs"
        onSend={onSend}
      />
      <div className="flex flex-wrap gap-2 rounded border bg-muted/20 p-3">
        <button
          type="button"
          data-testid="a2a-console-copy-request"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={!lastRequest}
          onClick={() => void copyRequest()}
        >
          Copy request
        </button>
        <button
          type="button"
          data-testid="a2a-console-download-response"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={lastResponse === null}
          onClick={downloadResponse}
        >
          Download response
        </button>
      </div>
    </div>
  );
}
