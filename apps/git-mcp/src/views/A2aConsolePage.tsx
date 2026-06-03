import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { Ps72A2aConsole, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  A2A_BASE_URL?: string;
}>;

function authHeaders(apiKey: string): Record<string, string> {
  const key = apiKey.trim();
  return key ? { Authorization: `Bearer ${key}`, "x-api-key": key } : {};
}

function websocketUrl(baseUrl: string, apiKey: string): string {
  const target = new URL(baseUrl.replace(/\/$/, "") + "/events/config");
  target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
  if (apiKey.trim()) {
    target.searchParams.set("token", apiKey.trim());
  }
  return target.toString();
}

function agentCardUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  return `${normalized.replace(/\/a2a$/i, "")}/.well-known/agent.json`;
}

function extractSkills(card: Record<string, unknown> | null): string[] {
  const fallback = ["root", "health", "config.events"];
  if (!card) return fallback;
  const raw = card.skills;
  if (!Array.isArray(raw)) return fallback;
  const skills = raw
    .map((skill) => {
      if (typeof skill === "string") return skill;
      if (!skill || typeof skill !== "object") return "";
      const record = skill as Record<string, unknown>;
      return String(record.id ?? record.name ?? "").trim();
    })
    .filter(Boolean);
  return Array.from(new Set([...fallback, ...skills]));
}

function requestId(): string {
  return crypto.randomUUID();
}

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const app = useGitMcpState();
  const endpointUrl = (cfg.A2A_BASE_URL ?? `${cfg.API_BASE_URL.replace(/\/$/, "")}/a2a`).replace(/\/$/, "");
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const cardResponse = await fetch(agentCardUrl(endpointUrl), {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const card = cardResponse.ok ? ((await cardResponse.json()) as Record<string, unknown>) : null;
        if (!cancelled) setAgentCard(card);

        const healthResponse = await fetch(`${endpointUrl}/health`, {
          credentials: "include",
          headers: { Accept: "application/json", ...authHeaders(app.apiKey) },
        });
        if (!cancelled) setHealth(healthResponse.ok ? "healthy" : "unhealthy");
      } catch {
        if (!cancelled) {
          setAgentCard(null);
          setHealth("unhealthy");
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [app.apiKey, endpointUrl]);

  const onSend = React.useCallback(
    async (action: string, payload: unknown, overrideKey: string): Promise<Ps72ExecuteResult> => {
      const normalized = action.trim().toLowerCase();
      const key = overrideKey.trim() || app.apiKey;
      const startedRequestId = requestId();
      const headers = { Accept: "application/json", ...authHeaders(key) };

      if (normalized === "root") {
        const resp = await fetch(endpointUrl, { credentials: "include", headers });
        const body: unknown = await resp.json().catch(() => ({ error: "Invalid JSON response" }));
        return {
          body,
          correlationId: resp.headers.get("X-Correlation-Id") ?? resp.headers.get("x-correlation-id") ?? startedRequestId,
          requestId: resp.headers.get("X-Request-Id") ?? resp.headers.get("x-request-id") ?? startedRequestId,
          httpStatus: resp.status,
          denied: !resp.ok,
        };
      }

      if (normalized === "health" || normalized === "status") {
        const resp = await fetch(`${endpointUrl}/health`, { credentials: "include", headers });
        const body: unknown = await resp.json().catch(() => ({ error: "Invalid JSON response" }));
        return {
          body,
          correlationId: resp.headers.get("X-Correlation-Id") ?? resp.headers.get("x-correlation-id") ?? startedRequestId,
          requestId: resp.headers.get("X-Request-Id") ?? resp.headers.get("x-request-id") ?? startedRequestId,
          httpStatus: resp.status,
          denied: !resp.ok,
        };
      }

      if (normalized === "config.events") {
        const socket = new WebSocket(websocketUrl(endpointUrl, key));
        const message = await new Promise<unknown>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            socket.close();
            reject(new Error("Timed out waiting for A2A config event."));
          }, 5000);
          socket.onopen = () => {
            if (payload && typeof payload === "object" && payload !== null) {
              socket.send(JSON.stringify(payload));
            }
          };
          socket.onmessage = (event) => {
            window.clearTimeout(timer);
            socket.close();
            try {
              resolve(JSON.parse(String(event.data)));
            } catch {
              resolve({ raw: event.data });
            }
          };
          socket.onerror = () => {
            window.clearTimeout(timer);
            reject(new Error("A2A WebSocket request failed."));
          };
        });
        return {
          body: message,
          correlationId: startedRequestId,
          requestId: startedRequestId,
          httpStatus: 200,
          denied: false,
        };
      }

      const resp = await fetch(`${endpointUrl}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: startedRequestId,
          skill_id: action,
          input: { text: typeof payload === "string" ? payload : JSON.stringify(payload ?? {}) },
        }),
      });
      const body: unknown = await resp.json().catch(() => ({ error: "Invalid JSON response" }));
      return {
        body,
        correlationId: resp.headers.get("X-Correlation-Id") ?? resp.headers.get("x-correlation-id") ?? startedRequestId,
        requestId: resp.headers.get("X-Request-Id") ?? resp.headers.get("x-request-id") ?? startedRequestId,
        httpStatus: resp.status,
        denied: !resp.ok,
      };
    },
    [app.apiKey, endpointUrl],
  );

  const authMode = cfg.AUTH_MODE ?? "api_key";
  const hasBoundKey = authMode === "cookie" || authMode === "oidc" ? auth.isAuthenticated : Boolean(app.apiKey.trim());
  const boundLabel =
    authMode === "cookie" || authMode === "oidc"
      ? auth.isAuthenticated
        ? "session"
        : "not signed in"
      : app.apiKey.trim()
        ? `••••${app.apiKey.trim().slice(-4)}`
        : "no bound key";

  return (
    <Ps72A2aConsole
      endpointUrl={endpointUrl}
      agentCard={agentCard}
      skills={extractSkills(agentCard)}
      health={health}
      hasBoundKey={hasBoundKey}
      boundLabel={boundLabel}
      docsHref="/api-docs"
      jobsHref="/jobs"
      onSend={onSend}
    />
  );
}
