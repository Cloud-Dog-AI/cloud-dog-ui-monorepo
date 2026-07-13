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

// @cloud-dog/app-index-retriever — A2A console using the shared pattern.

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import { Ps72A2aConsole } from "@cloud-dog/ui";
import type { Ps72HealthState } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import { extractA2aSkills, maskBoundKey, ps72A2aTaskCall, resolveAppUrl } from "../lib/ps72Console";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  A2A_BASE_URL?: string;
}>;

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();
  const { api, apiKey, captureFailure, recordActivity } = app;
  const [status, setStatus] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);

  const endpointUrl = cfg.A2A_BASE_URL?.trim() || `${window.location.origin}/a2a`;
  const agentCardUrl = React.useMemo(() => {
    return resolveAppUrl("/a2a/.well-known/agent.json", window.location.origin);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const headers = new Headers({ accept: "application/json" });
    const token = apiKey.trim();
    if (token) headers.set("x-api-key", token);

    const load = async () => {
      setError(null);
      try {
        const [cardResponse] = await Promise.all([
          fetch(agentCardUrl, { credentials: "include", headers }),
          api.getA2aHealth(),
        ]);
        const card = (await cardResponse.json()) as Record<string, unknown>;
        if (!mounted) return;
        setAgentCard(cardResponse.ok ? card : null);
        setHealth(cardResponse.ok ? "healthy" : "degraded");
        setStatus(cardResponse.ok ? "Loaded A2A agent card" : "A2A agent card unavailable");
      } catch (loadError) {
        if (!mounted) return;
        const message = captureFailure(loadError);
        setError(message);
        setHealth("unhealthy");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [agentCardUrl, api, apiKey, captureFailure]);

  const onSend = async (action: string, payload: unknown, overrideKey: string) => {
    setError(null);
    setStatus("");

    try {
      const result = await ps72A2aTaskCall({
        apiBaseUrl: cfg.API_BASE_URL,
        action,
        payload,
        boundApiKey: apiKey,
        overrideKey,
      });
      setStatus(`Submitted A2A action ${action}`);
      recordActivity(`a2a.${action || "unknown"}`, result.denied ? "error" : "ok", result.denied ? String(result.httpStatus) : undefined);
      return result;
    } catch (runError) {
      const message = captureFailure(runError);
      setError(message);
      recordActivity(`a2a.${action || "unknown"}`, "error", message);
      throw runError;
    }
  };
  const hasBoundKey = cfg.AUTH_MODE === "api_key" ? Boolean(apiKey.trim()) : true;
  const skills = extractA2aSkills(agentCard);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">A2A Console</h1>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}

      <Ps72A2aConsole
        endpointUrl={endpointUrl}
        agentCard={agentCard}
        skills={skills}
        health={health}
        hasBoundKey={hasBoundKey}
        boundLabel={maskBoundKey(apiKey)}
        docsHref="/api-docs#a2a"
        jobsHref="/system/jobs"
        onSend={onSend}
      />
    </div>
  );
}
