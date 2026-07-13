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

// @cloud-dog/app-code-runner — A2A console (PS-72 v2 conformant via shared Ps72A2aConsole, W28A-773).

import * as React from "react";
import { ApiError } from "@cloud-dog/api-client";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { Ps72A2aConsole, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useCodeRunnerState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
  API_KEY_HEADER?: string;
}>;

function resolveBrowserA2aBase(value: string): string {
  const raw = value.replace(/\/$/, "");
  if (typeof window === "undefined") return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin === window.location.origin && !parsed.pathname.includes("/weba2a")) {
      return `${window.location.origin}/weba2a`;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function extractSkills(card: Record<string, unknown> | null): string[] {
  const fallback = ["root", "health", "status"];
  if (!card) return fallback;
  const raw = card.skills;
  if (Array.isArray(raw)) {
    const names = raw
      .map((s) => (typeof s === "string" ? s : typeof s === "object" && s ? String((s as Record<string, unknown>).id ?? (s as Record<string, unknown>).name ?? "") : ""))
      .filter((s) => s.trim());
    if (names.length > 0) return [...fallback, ...names];
  }
  return fallback;
}

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const { api, apiKey } = useCodeRunnerState();
  const apiKeyHeader = cfg.API_KEY_HEADER ?? "X-API-Key";
  const a2aBaseUrl = resolveBrowserA2aBase(cfg.A2A_BASE_URL ?? cfg.API_BASE_URL);
  const authMode = cfg.AUTH_MODE ?? "api_key";

  const agentCardUrl = React.useMemo(
    () => new URL(".well-known/agent.json", `${a2aBaseUrl.replace(/\/$/, "")}/`).toString(),
    [a2aBaseUrl],
  );

  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  const headers = React.useCallback(
    (overrideKey?: string): Record<string, string> => {
      const out: Record<string, string> = { Accept: "application/json" };
      const key = (overrideKey && overrideKey.trim()) || apiKey;
      if (key && key.trim()) out[apiKeyHeader] = key.trim();
      return out;
    },
    [apiKey, apiKeyHeader],
  );

  React.useEffect(() => {
    let cancelled = false;
    void api.request<Record<string, unknown>>("/weba2a/.well-known/agent.json", { headers: headers() })
      .then((json) => {
        if (!cancelled) { setAgentCard(json); setHealth("healthy"); }
      })
      .catch(() => {
        if (!cancelled) { setAgentCard(null); setHealth("unhealthy"); }
      });
    return () => { cancelled = true; };
  }, [agentCardUrl, api, headers]);

  const onSend = React.useCallback(
    async (action: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const normalized = action.trim().toLowerCase();
      const target =
        normalized === "root" ? "/weba2a/.well-known/agent.json"
        : normalized === "health" || normalized === "status" ? "/weba2a/health"
        : "/weba2a/tasks";
      try {
        const body: unknown = await api.request(target, {
          method: normalized === "root" || normalized === "health" || normalized === "status" ? "GET" : "POST",
          headers: headers(overrideKey),
          body: normalized === "root" || normalized === "health" || normalized === "status" ? undefined : { action, payload },
        });
        return { body, correlationId: null, requestId: null, httpStatus: 200, denied: false };
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
      ? auth.isAuthenticated ? "session • cookie" : "not signed in"
      : apiKey && apiKey.trim() ? `••••${apiKey.trim().slice(-4)}` : "no bound key";

  return (
    <Ps72A2aConsole
      endpointUrl={a2aBaseUrl}
      agentCard={agentCard}
      skills={extractSkills(agentCard)}
      health={health}
      hasBoundKey={hasBoundKey}
      boundLabel={boundLabel}
      docsHref="/api-docs"
      jobsHref="/system/jobs"
      onSend={onSend}
    />
  );
}
