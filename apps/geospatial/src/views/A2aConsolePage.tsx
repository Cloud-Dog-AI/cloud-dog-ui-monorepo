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

// A2A console (PS-72 v2) via the shared Ps72A2aConsole. geospatial-mcp exposes its agent
// card at /.well-known/agent.json and task submission at /a2a/tasks (web-tier proxied).

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Ps72A2aConsole, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";

function extractSkills(card: Record<string, unknown> | null): string[] {
  const base = ["root", "health"];
  const raw = card?.skills;
  if (Array.isArray(raw)) {
    const ids = raw
      .map((s) => (typeof s === "string" ? s : s && typeof s === "object" ? String((s as Record<string, unknown>).id ?? (s as Record<string, unknown>).name ?? "") : ""))
      .filter((s) => s.trim());
    if (ids.length) return [...base, ...ids];
  }
  return [...base, "geo_list_providers", "geo_geocode", "geo_render_map"];
}

export function A2aConsolePage() {
  const auth = useAuth();
  const { api } = useGeoState();
  const a2aBaseUrl = `${window.location.origin}/a2a`;

  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  React.useEffect(() => {
    let cancelled = false;
    api.a2aAgentCard()
      .then((card) => { if (!cancelled) { setAgentCard(card); setHealth("healthy"); } })
      .catch(() => { if (!cancelled) { setAgentCard(null); setHealth("unhealthy"); } });
    return () => { cancelled = true; };
  }, [api]);

  const onSend = React.useCallback(
    async (action: string, payload: unknown): Promise<Ps72ExecuteResult> => {
      const normalized = action.trim().toLowerCase();
      if (normalized === "root" || normalized === "health" || normalized === "status") {
        try {
          const body = normalized === "root" ? await api.a2aAgentCard() : await api.a2aHealth();
          return { body, correlationId: null, requestId: null, httpStatus: 200, denied: false };
        } catch (e) {
          const status = (e as { options?: { status?: number } })?.options?.status ?? 0;
          return { body: { error: (e as Error)?.message ?? "request failed" }, correlationId: null, requestId: null, httpStatus: status, denied: true };
        }
      }
      const res = await api.a2aTask(action, payload);
      return {
        body: res.body,
        correlationId: res.correlationId,
        requestId: res.requestId,
        httpStatus: res.httpStatus,
        denied: res.denied,
      };
    },
    [api],
  );

  return (
    <Ps72A2aConsole
      endpointUrl={a2aBaseUrl}
      agentCard={agentCard}
      skills={extractSkills(agentCard)}
      health={health}
      hasBoundKey={auth.isAuthenticated}
      boundLabel={auth.isAuthenticated ? "session • cookie" : "not signed in"}
      docsHref="/developer/api-docs"
      jobsHref="/system/jobs"
      onSend={onSend}
    />
  );
}
