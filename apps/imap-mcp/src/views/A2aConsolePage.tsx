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
import { useConfig } from "@cloud-dog/config";
import { A2aConsole, Card, CardContent, CardHeader, JsonBlock, Spinner } from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  A2A_BASE_URL?: string;
}>;

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api } = useImapMcpState();
  const a2aBaseUrl = cfg.A2A_BASE_URL ?? cfg.API_BASE_URL;

  // Default skill is mail_search — the IMAP A2A server registers exactly
  // mail_search, mail_get_message, mail_probe. Hard-coding list_profiles
  // here caused HTTP 404 ("Unknown skill") in the Console panel.
  const [toolName, setToolName] = React.useState("mail_search");
  const [tools, setTools] = React.useState<string[]>([]);
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
      const loaded = result.data.map((item) => item.name);
      setTools(loaded);
      setToolName(loaded.includes("mail_search") ? "mail_search" : loaded[0] ?? "mail_search");
    };
    void loadTools();
  }, [api]);

  React.useEffect(() => {
    setLoadingCard(true);
    void Promise.all([
      fetch("/.well-known/agent.json", { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .then((card) => setAgentCard(card as Record<string, unknown> | null))
        .catch(() => setAgentCard(null)),
      fetch("/a2a/health", { credentials: "include" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => setHealthPayload(payload as Record<string, unknown> | null))
        .catch(() => setHealthPayload(null)),
    ]).finally(() => setLoadingCard(false));
  }, []);

  const skills = Array.isArray(agentCard?.skills)
    ? (agentCard.skills as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">A2A Console</h1>
        <p className="text-sm text-muted-foreground">
          Agent card, skills, event status, task submission, and structured response inspection for the IMAP A2A surface.
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Agent Card &amp; Skills</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingCard ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />
              Loading A2A agent card...
            </div>
          ) : agentCard ? (
            <>
              <p className="text-sm">
                <span className="font-medium">Agent:</span> {String(agentCard.name ?? agentCard.id ?? "imap-mcp")}
              </p>
              {skills.length > 0 ? (
                <ul className="ml-4 list-disc text-sm">
                  {skills.map((skill, index) => (
                    <li key={`${String(skill.id ?? skill.name ?? "skill")}-${index}`}>
                      {String(skill.id ?? skill.name ?? "skill")} - {String(skill.description ?? "")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No skills declared in the agent card.</p>
              )}
              <JsonBlock title="Full Agent Card" value={agentCard} defaultCollapsed />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Agent card unavailable at <code>/.well-known/agent.json</code>; task events can still be submitted below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">A2A agent status</h2>
        </CardHeader>
        <CardContent>
          <JsonBlock title="A2A event status" value={healthPayload ?? { status: "unknown" }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">A2A Task Console</h2>
          <p className="text-sm text-muted-foreground">Send a task event and inspect the structured response.</p>
        </CardHeader>
        <CardContent>
          <A2aConsole
            endpointUrl={a2aBaseUrl}
            onSend={(topic, payload) =>
              api
                .callA2ATool(
                  tools.includes(topic.trim()) ? topic.trim() : toolName,
                  (payload ?? {}) as Record<string, unknown>
                )
                .then((result) => (result.ok ? result.raw : {
                  response: result.errorMessage || "A2A task returned an error.",
                  error_code: result.errorCode,
                  status: result.meta.status,
                }))
                .catch((sendError) => ({
                  response: sendError instanceof Error ? sendError.message : "A2A task failed.",
                  status: "failed",
                }))
            }
          />
        </CardContent>
      </Card>

    </div>
  );
}
