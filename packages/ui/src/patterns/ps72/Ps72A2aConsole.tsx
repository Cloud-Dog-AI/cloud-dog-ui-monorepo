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

// @cloud-dog/ui — PS-72 v2 A2A Console (shared, promoted under W28A-773).
//
// PS-72 v2 §1-§9 + §8 A2A specifics (agent card + events stream). Per the PS-72
// §1 data-testid table the SHARED elements (request editor, API-key field,
// submit, result/meta, status badge, docs link) carry the canonical
// `mcp-console-*` testids even on the A2A page; only the page root and the A2A
// additions use `a2a-console-*`. NO assertion is weakened (PC17).

import * as React from "react";
import { Button } from "../../components/button/Button";
import { Input } from "../../components/input/Input";
import { Textarea } from "../../components/input/Textarea";
import { Ps72ApiKeyField, Ps72HealthBadge, Ps72ResultMeta } from "./Ps72Parts";
import {
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72LifecycleState,
  type Ps72Meta,
} from "./metaTypes";

export type Ps72A2aEvent = Readonly<{
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  payload: unknown;
}>;

export type Ps72A2aConsoleProps = Readonly<{
  endpointUrl: string;
  /** Parsed agent card from the server card endpoint (§8.1) — null => unhealthy. */
  agentCard: Record<string, unknown> | null;
  /** Card-described skills/actions to populate the request template (§3.2). */
  skills: string[];
  health: Ps72HealthState;
  hasBoundKey: boolean;
  boundLabel: string;
  docsHref: string;
  jobsHref: string;
  /** Send an A2A task; returns the final result + correlation/request metadata. */
  onSend: (action: string, payload: unknown, overrideKey: string) => Promise<Ps72ExecuteResult>;
}>;

function a2aTemplateForAction(action: string): Record<string, unknown> {
  if (action === "send_notification" || action === "notify/natural") {
    return {
      command: "Send notification to gary@cloud-dog.net that the local PS-72 notification-agent A2A test completed.",
      channels: ["loopback_test"],
    };
  }
  if (action === "list_channels") {
    return { command: "List available notification channels." };
  }
  if (action === "get_status") {
    return { command: "Get notification delivery status." };
  }
  if (action === "file-management") {
    return { tool: "list_dir", arguments: { path: "/", recursive: false } };
  }
  if (action === "file-search") {
    return { query: "" };
  }
  if (action === "file-transfer") {
    return { action: "list", directory: "/" };
  }
  if (action === "gdrive-sync") {
    return { tool: "list_dir", arguments: { path: "/" } };
  }
  return {};
}

export function Ps72A2aConsole(props: Ps72A2aConsoleProps) {
  const [action, setAction] = React.useState(props.skills[0] ?? "");
  const [requestText, setRequestText] = React.useState(() => JSON.stringify(a2aTemplateForAction(props.skills[0] ?? ""), null, 2));
  const [overrideKey, setOverrideKey] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<unknown | null>(null);
  const [meta, setMeta] = React.useState<Ps72Meta | null>(null);
  const [denied, setDenied] = React.useState(false);
  const [events, setEvents] = React.useState<Ps72A2aEvent[]>([]);

  React.useEffect(() => {
    if (action && props.skills.includes(action)) return;
    const next = props.skills[0] ?? "";
    setAction(next);
    setRequestText(JSON.stringify(a2aTemplateForAction(next), null, 2));
  }, [action, props.skills]);

  const pushEvent = (type: string, summary: string, payload: unknown) => {
    setEvents((prev) => [
      { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, summary, payload },
      ...prev,
    ]);
  };

  const selectAction = (next: string) => {
    setAction(next);
    setRequestText(JSON.stringify(a2aTemplateForAction(next), null, 2));
    setResult(null);
    setMeta(null);
    setDenied(false);
  };

  const submit = async () => {
    if (!action.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(requestText);
    } catch {
      setDenied(true);
      setResult({ error: "Request is not valid JSON." });
      setMeta(null);
      return;
    }
    setRunning(true);
    const startedAt = performance.now();
    pushEvent("request", `Submitted "${action}"`, parsed);
    try {
      const exec = await props.onSend(action, parsed, overrideKey);
      const durationMs = performance.now() - startedAt;
      const status: Ps72LifecycleState = exec.denied ? "failed" : "succeeded";
      const clientGenerated = !exec.correlationId || !exec.requestId;
      setResult(exec.body);
      setDenied(exec.denied);
      setMeta({
        correlationId: exec.correlationId && exec.correlationId.trim() ? exec.correlationId : `client-${crypto.randomUUID()}`,
        requestId: exec.requestId && exec.requestId.trim() ? exec.requestId : `client-${crypto.randomUUID()}`,
        durationMs,
        status,
        clientGenerated,
      });
      pushEvent(exec.denied ? "error" : "result", exec.denied ? "Task denied" : "Task completed", exec.body);
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      setResult({ error: message });
      setDenied(true);
      setMeta({
        correlationId: `client-${crypto.randomUUID()}`,
        requestId: `client-${crypto.randomUUID()}`,
        durationMs,
        status: "failed",
        clientGenerated: true,
      });
      pushEvent("error", "Task failed", { error: message });
    } finally {
      setRunning(false);
    }
  };

  const cardName = props.agentCard
    ? String(props.agentCard.name ?? props.agentCard.title ?? "Agent")
    : "Agent card unavailable";
  const cardVersion = props.agentCard ? String(props.agentCard.version ?? "") : "";

  return (
    <div data-testid="a2a-console-page" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">A2A Console</h2>
          <Ps72HealthBadge state={props.health} testId="mcp-console-status-badge" />
        </div>
        <a data-testid="mcp-console-docs-link" href={props.docsHref} className="text-sm font-medium text-sky-700 hover:underline">
          Docs
        </a>
      </div>

      <div className="flex rounded-md border bg-background">
        {/* §8 left panel: agent card + events stream */}
        <div className="w-72 shrink-0 border-r p-3">
          <div data-testid="a2a-console-agent-card" className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-900">{cardName}</div>
            {cardVersion ? <div className="text-xs text-slate-500">v{cardVersion}</div> : null}
            {props.agentCard ? (
              <>
              <div className="mt-2 text-xs text-slate-500">
                {props.skills.length} skills (<span data-testid="mcp-console-tool-count">{props.skills.length}</span>)
              </div>
              <ul data-testid="mcp-console-tool-list" className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-600" aria-label="Available A2A skills">
                {props.skills.map((skill) => (
                  <li key={skill}>
                    <button
                      type="button"
                      data-testid={`a2a-console-skill-${skill}`}
                      className={`w-full rounded-md px-2 py-1 text-left font-mono hover:bg-white ${skill === action ? "bg-white font-semibold" : ""}`}
                      onClick={() => selectAction(skill)}
                    >
                      {skill}
                    </button>
                  </li>
                ))}
                {props.skills.length === 0 ? <li className="text-slate-400">No skills advertised.</li> : null}
              </ul>
              </>
            ) : (
              <p className="mt-2 text-xs text-rose-700">Agent card could not be resolved from the bridge.</p>
            )}
          </div>

          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Events</div>
          <ul data-testid="a2a-console-events-stream" className="mt-1 max-h-72 space-y-1 overflow-y-auto">
            {events.map((event) => (
              <li key={event.id} className="rounded border border-slate-200 bg-white p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{event.type}</span>
                  <span className="text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-600">{event.summary}</div>
              </li>
            ))}
            {events.length === 0 ? <li className="text-xs text-slate-400">No events yet.</li> : null}
          </ul>
        </div>

        {/* §1 centre: request → apikey → submit → result+meta */}
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="text-xs text-muted-foreground">{props.endpointUrl}</div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="a2a-console-action">
            Action / skill
          </label>
          {props.skills.length > 0 ? (
            <select
              id="a2a-console-action"
              data-testid="a2a-console-action"
              className="w-full rounded-md border px-2 py-1 text-sm"
              value={action}
              onChange={(event) => selectAction(event.target.value)}
              aria-label="Action"
            >
              {props.skills.map((skill) => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          ) : (
            <Input
              id="a2a-console-action"
              data-testid="a2a-console-action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder='e.g. "root", "health", or a skill name from the agent card'
              aria-label="Action"
            />
          )}

          <label data-testid="mcp-console-request-label" className="block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="mcp-console-request-editor">
            Request
          </label>
          <Textarea
            id="mcp-console-request-editor"
            data-testid="mcp-console-request-editor"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
            className="font-mono text-xs"
            aria-label="Request"
            rows={6}
          />

          <Ps72ApiKeyField
            testIdPrefix="mcp-console"
            boundLabel={props.boundLabel}
            hasBoundKey={props.hasBoundKey}
            overrideValue={overrideKey}
            onOverrideChange={setOverrideKey}
          />

          {overrideKey.trim() ? <p className="text-xs text-amber-700">Submitting as admin override.</p> : null}

          <Button data-testid="mcp-console-submit" onClick={submit} disabled={running || !action.trim()}>
            {running ? "Submitting…" : "Submit"}
          </Button>

          <Ps72ResultMeta testIdPrefix="mcp-console" result={result} meta={meta} denied={denied} jobsHref={props.jobsHref} />
        </div>
      </div>
    </div>
  );
}
