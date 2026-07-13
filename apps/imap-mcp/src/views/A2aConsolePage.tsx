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

// @cloud-dog/app-imap-mcp — Wrapper page for the shared A2aConsole component.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { Card, CardContent, CardHeader, Ps72A2aConsole, Spinner, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";
import type { CallResult, JsonRecord, ToolDescriptor } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  UI_BASE_PATH?: string;
}>;

function uiHref(basePath: string | undefined, path: string): string {
  const base = (basePath ?? "/ui").replace(/\/+$/, "");
  const target = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${target}` : target;
}

function templateValueForProperty(value: Record<string, unknown>): unknown {
  if ("default" in value) return value.default;
  if (Array.isArray(value.enum) && value.enum.length > 0) return value.enum[0];
  switch (value.type) {
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

function payloadTemplateForSkill(skill: Record<string, unknown>): Record<string, unknown> {
  const schema = (skill.inputSchema ?? skill.input_schema) as Record<string, unknown> | undefined;
  const examples = schema && Array.isArray(schema.examples) ? schema.examples : [];
  if (examples.length > 0 && examples[0] && typeof examples[0] === "object") {
    return examples[0] as Record<string, unknown>;
  }
  if (schema?.example && typeof schema.example === "object") {
    return schema.example as Record<string, unknown>;
  }
  const properties = schema?.properties && typeof schema.properties === "object"
    ? (schema.properties as Record<string, Record<string, unknown>>)
    : {};
  const template = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, templateValueForProperty(value)]),
  );
  return Object.keys(template).length > 0 ? template : {};
}

function skillId(skill: Record<string, unknown>): string {
  return String(skill.id ?? skill.name ?? "").trim();
}

function skillNames(agentCard: Record<string, unknown> | null, fallbackTools: string[]): string[] {
  const rawSkills = Array.isArray(agentCard?.skills) ? (agentCard.skills as Array<Record<string, unknown>>) : [];
  const names = rawSkills.map(skillId).filter(Boolean);
  return Array.from(new Set([...names, ...fallbackTools])).filter(Boolean);
}

function skillTemplates(agentCard: Record<string, unknown> | null): Record<string, unknown> {
  const rawSkills = Array.isArray(agentCard?.skills) ? (agentCard.skills as Array<Record<string, unknown>>) : [];
  return Object.fromEntries(
    rawSkills
      .map((skill) => [skillId(skill), payloadTemplateForSkill(skill)] as const)
      .filter(([id, template]) => id.length > 0 && Object.keys(template).length > 0),
  );
}

function toolTemplates(tools: ToolDescriptor[]): Record<string, unknown> {
  return Object.fromEntries(
    tools
      .map((tool) => [
        tool.name,
        payloadTemplateForSkill({ id: tool.name, input_schema: tool.input_schema ?? {} }),
      ] as const)
      .filter(([id, template]) => id.length > 0 && Object.keys(template).length > 0),
  );
}

function healthState(agentCard: Record<string, unknown> | null, healthPayload: Record<string, unknown> | null, error: string): Ps72HealthState {
  if (error) return "unhealthy";
  const status = String(healthPayload?.status ?? healthPayload?.health ?? "").toLowerCase();
  if (status === "healthy" || status === "degraded" || status === "unhealthy") return status;
  return agentCard ? "healthy" : "unknown";
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
  const candidate = result.job_id ?? result.jobId ?? result.job;
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

export function A2aConsolePage() {
  const auth = useAuth();
  const cfg = useConfig<RuntimeConfig>();
  const { api, apiKey } = useImapMcpState();
  const authMode = cfg.AUTH_MODE ?? "cookie";
  const a2aBaseUrl = cfg.A2A_BASE_URL ?? cfg.API_BASE_URL;
  const [tools, setTools] = React.useState<ToolDescriptor[]>([]);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [healthPayload, setHealthPayload] = React.useState<Record<string, unknown> | null>(null);
  const [loadingCard, setLoadingCard] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const loadTools = async () => {
      const result = await api.listA2ATools();
      if (!result.ok || !result.data) {
        setError(result.errorMessage || "Failed to load A2A tools.");
        return;
      }
      setTools(result.data);
    };
    void loadTools();
  }, [api]);

  React.useEffect(() => {
    setLoadingCard(true);
    const key = apiKey.trim();
    const headers = key
      ? { "x-api-key": key, Authorization: `Bearer ${key}` }
      : undefined;
    void Promise.all([
      fetch("/weba2a/.well-known/agent.json", { credentials: "include", headers })
        .then((response) => (response.ok ? response.json() : null))
        .then((card) => setAgentCard(card as Record<string, unknown> | null))
        .catch(() => setAgentCard(null)),
      fetch("/weba2a/health", { credentials: "include", headers })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => setHealthPayload(payload as Record<string, unknown> | null))
        .catch(() => setHealthPayload(null)),
    ]).finally(() => setLoadingCard(false));
  }, [apiKey]);

  const toolNames = React.useMemo(() => tools.map((item) => item.name), [tools]);
  const skills = skillNames(agentCard, toolNames);
  const templates = React.useMemo(() => (
    { ...toolTemplates(tools), ...skillTemplates(agentCard) }
  ), [agentCard, tools]);
  const hasBoundKey = authMode === "cookie" || authMode === "oidc" ? auth.isAuthenticated : Boolean(apiKey.trim());
  const currentBoundLabel = boundKeyLabel(authMode, auth.isAuthenticated, apiKey);
  const currentHealth = healthState(agentCard, healthPayload, error);

  const sendTask = React.useCallback(
    async (action: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const selected = toolNames.includes(action.trim()) ? action.trim() : (toolNames[0] ?? action.trim());
      const body = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as JsonRecord) : {};
      const result = await api.callA2ATool<unknown>(selected, body, overrideKey);
      return toPs72Result(result);
    },
    [api, toolNames],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">A2A Console</h1>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">A2A task console</h2>
        </CardHeader>
        <CardContent>
          {loadingCard ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />
              Loading A2A console...
            </div>
          ) : (
            <Ps72A2aConsole
              endpointUrl={a2aBaseUrl}
              agentCard={agentCard}
              skills={skills}
              skillTemplates={templates}
              health={currentHealth}
              hasBoundKey={hasBoundKey}
              boundLabel={currentBoundLabel}
              docsHref={uiHref(cfg.UI_BASE_PATH, "/api-docs#a2a")}
              jobsHref={uiHref(cfg.UI_BASE_PATH, "/jobs")}
              onSend={sendTask}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
