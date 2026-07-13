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

// A2A console (PS-72 v2) via the shared Ps72A2aConsole. chart-mcp exposes its agent
// card at /.well-known/agent.json and task submission at /a2a/tasks (web-tier proxied).

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Ps72A2aConsole, type Ps72ExecuteResult, type Ps72HealthState } from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";

function extractSkills(card: Record<string, unknown> | null): string[] {
  const base = ["root", "health"];
  const raw = card?.skills;
  if (Array.isArray(raw)) {
    const ids = raw
      .map((s) => (typeof s === "string" ? s : s && typeof s === "object" ? String((s as Record<string, unknown>).id ?? (s as Record<string, unknown>).name ?? "") : ""))
      .filter((s) => s.trim());
    if (ids.length) return [...base, ...ids];
  }
  return [...base, "recommend", "validate", "render"];
}

export function A2aConsolePage() {
  const auth = useAuth();
  const { api } = useChartState();
  const origin = window.location.origin;
  const a2aBaseUrl = `${origin}/a2a`;

  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");

  React.useEffect(() => {
    let cancelled = false;
    void api.a2aAgentCard()
      .then((card) => { if (!cancelled) { setAgentCard(card); setHealth("healthy"); } })
      .catch(() => { if (!cancelled) { setAgentCard(null); setHealth("unhealthy"); } });
    return () => { cancelled = true; };
  }, [api]);

  const onSend = React.useCallback(
    async (action: string, payload: unknown): Promise<Ps72ExecuteResult> => {
      const normalized = action.trim().toLowerCase();
      let result;
      if (normalized === "root") {
        result = { body: await api.a2aAgentCard(), httpStatus: 200, denied: false, correlationId: null, requestId: null };
      } else if (normalized === "health" || normalized === "status") {
        result = { body: await api.a2aHealth(), httpStatus: 200, denied: false, correlationId: null, requestId: null };
      } else {
        result = await api.a2aTask(action, payload);
      }
      return {
        body: result.body,
        correlationId: result.correlationId,
        requestId: result.requestId,
        httpStatus: result.httpStatus,
        denied: result.denied,
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
