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
import { A2aConsole, Badge, Card, CardContent, CardHeader, JsonBlock } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

type RuntimeConfig = Readonly<{
  A2A_BASE_URL?: string;
  API_BASE_URL: string;
}>;

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();
  const [lastResponse, setLastResponse] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  const endpointUrl = `${window.location.origin}/a2a`;
  const agentCardUrl = React.useMemo(() => {
    return new URL("/a2a/.well-known/agent.json", window.location.origin).toString();
  }, []);
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    fetch(agentCardUrl).then((r) => r.json()).then((c) => setAgentCard(c as Record<string, unknown>)).catch(() => {});
  }, [agentCardUrl]);

  const onSend = async (topic: string, payload: unknown) => {
    setError(null);
    setStatus("");

    try {
      const normalized = topic.trim().toLowerCase();
      let response: unknown;
      if (normalized === "health") {
        response = await app.api.getA2aHealth();
      } else if (normalized === "events") {
        response = await app.api.getA2aEvents();
      } else if (normalized === "root") {
        response = await app.api.getA2aRoot();
      } else {
        response = {
          status: "unsupported_topic",
          supported_topics: ["root", "health", "events"],
          requested_topic: topic,
          payload,
        } satisfies JsonRecord;
      }

      setLastResponse(response);
      setStatus(`A2A topic ${topic} executed`);
      app.recordActivity(`a2a.${normalized || "unknown"}`, "ok");
      return response;
    } catch (runError) {
      const message = app.captureFailure(runError);
      setError(message);
      app.recordActivity(`a2a.${topic || "unknown"}`, "error", message);
      throw runError;
    }
  };

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

      {/* PS-72 MW4: Auth display */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Authentication</h2>
            <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">session</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">A2A endpoint: <code className="text-xs">{endpointUrl}</code></p>
        </CardContent>
      </Card>

      {/* PS-72 MW3: Agent card */}
      {agentCard ? (
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Agent Card</h2></CardHeader>
          <CardContent>
            <JsonBlock title="Agent Card" value={agentCard} defaultCollapsed={false} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Shared A2A console</h2>
        </CardHeader>
        <CardContent>
          <A2aConsole endpointUrl={endpointUrl} onSend={onSend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Last A2A response</h2>
        </CardHeader>
        <CardContent>
          <JsonBlock title="response" value={lastResponse ?? {}} />
        </CardContent>
      </Card>
    </div>
  );
}
