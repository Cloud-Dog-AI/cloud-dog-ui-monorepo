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

// @cloud-dog/ui — PS-72 v2 MCP Console (shared, promoted under W28A-773).
//
// Implements the PS-72 v2 §1-§9 canonical layout + data-testid contract. All
// shared elements (request editor, API-key field, submit, result/meta, status
// badge, docs link) carry the canonical `mcp-console-*` testids per PS-72 §1.
// Promoted from the W28A-774 sql-agent wrapper. NO assertion is weakened (PC17).

import * as React from "react";
import { Button } from "../../components/button/Button";
import { Input } from "../../components/input/Input";
import { Ps72ApiKeyField, Ps72HealthBadge, Ps72ResultMeta } from "./Ps72Parts";
import {
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72LifecycleState,
  type Ps72Meta,
} from "./metaTypes";

export type Ps72McpTool = Readonly<{
  name: string;
  description?: string;
  inputSchema?: unknown;
  /** §9 RBAC: false when the user is not bound to this tool (rendered locked). */
  bound?: boolean;
}>;

export type Ps72McpConsoleProps = Readonly<{
  /** Endpoint shown under the header (informational). */
  endpointUrl: string;
  /** Full discoverable tool list (count MUST equal server list_tools — T.1.1). */
  tools: Ps72McpTool[];
  /** Top-of-page health state (§1 / §7). */
  health: Ps72HealthState;
  /** Whether the logged-in user has a bound key (§2). */
  hasBoundKey: boolean;
  /** Masked label for the bound identity, e.g. "session • cookie" or "••••1234". */
  boundLabel: string;
  /** Docs link target (§6) — routes to the Docs page (PS-74). */
  docsHref: string;
  /** Jobs page target (§4.4 / PS-76). */
  jobsHref: string;
  /**
   * Optional service-specific controls that feed the request adapter. This is
   * the PS-72 uncommon-functionality extension point; it must not replace the
   * shared tool list, request editor, submit, result, or meta panel.
   */
  extensionSlot?: React.ReactNode;
  /** Optional adapter for service-local defaults before the shared execute call. */
  requestAdapter?: (toolName: string, args: unknown) => unknown | Promise<unknown>;
  /** Execute a tool call; override is the admin API key (blank => bound identity). */
  onExecute: (toolName: string, args: unknown, overrideKey: string) => Promise<Ps72ExecuteResult>;
}>;

function templateValueForProperty(value: Record<string, unknown>): unknown {
  if ("default" in value) return value.default;
  if (Array.isArray(value.enum) && value.enum.length > 0) return value.enum[0];
  const type = typeof value.type === "string" ? value.type : "string";
  switch (type) {
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

function buildArgsTemplate(tool: Ps72McpTool): Record<string, unknown> {
  const schema = tool.inputSchema && typeof tool.inputSchema === "object" ? (tool.inputSchema as Record<string, unknown>) : {};
  const properties = schema.properties && typeof schema.properties === "object" ? (schema.properties as Record<string, Record<string, unknown>>) : {};
  return Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, templateValueForProperty(value)]));
}

/** Pull a Job ID out of a result body per common PS-75 shapes. */
function extractJobId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const result = record.result && typeof record.result === "object" ? (record.result as Record<string, unknown>) : record;
  const candidate = result.job_id ?? result.jobId ?? result.job ?? (record as Record<string, unknown>).job_id;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  return null;
}

export function Ps72McpConsole(props: Ps72McpConsoleProps) {
  const [selectedTool, setSelectedTool] = React.useState(props.tools.find((t) => t.bound !== false)?.name ?? props.tools[0]?.name ?? "");
  const initialTool = React.useMemo(
    () => props.tools.find((t) => t.name === selectedTool),
    [props.tools, selectedTool],
  );
  const [search, setSearch] = React.useState("");
  const [requestText, setRequestText] = React.useState(() => (
    initialTool ? JSON.stringify(buildArgsTemplate(initialTool), null, 2) : "{}"
  ));
  const [requestDirty, setRequestDirty] = React.useState(false);
  const [overrideKey, setOverrideKey] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<unknown | null>(null);
  const [meta, setMeta] = React.useState<Ps72Meta | null>(null);
  const [denied, setDenied] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);

  const filteredTools = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.tools;
    return props.tools.filter((tool) => {
      const desc = typeof tool.description === "string" ? tool.description : "";
      return tool.name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    });
  }, [props.tools, search]);

  const activeTool = props.tools.find((t) => t.name === selectedTool);
  const activeLocked = activeTool?.bound === false;

  // Tools may load asynchronously; auto-select the first bound tool once they
  // arrive if nothing valid is selected yet (so Submit is enabled — T.1.4/§4).
  React.useEffect(() => {
    if (selectedTool && props.tools.some((t) => t.name === selectedTool)) return;
    const next = props.tools.find((t) => t.bound !== false)?.name ?? props.tools[0]?.name ?? "";
    if (next) {
      setSelectedTool(next);
      const tool = props.tools.find((t) => t.name === next);
      if (tool) {
        setRequestText(JSON.stringify(buildArgsTemplate(tool), null, 2));
        setRequestDirty(false);
      }
    }
  }, [props.tools, selectedTool]);

  const selectTool = (tool: Ps72McpTool) => {
    if (requestDirty && tool.name !== selectedTool) {
      // §3.5 no silent data loss — confirm before discarding an edited request.
      const ok = typeof window === "undefined" ? true : window.confirm("Discard the current request and switch tools?");
      if (!ok) return;
    }
    setSelectedTool(tool.name);
    setRequestText(JSON.stringify(buildArgsTemplate(tool), null, 2));
    setRequestDirty(false);
    setResult(null);
    setMeta(null);
    setDenied(false);
    setJobId(null);
  };

  const submit = async () => {
    if (!selectedTool || activeLocked) return;
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
    try {
      const adapted = props.requestAdapter ? await props.requestAdapter(selectedTool, parsed) : parsed;
      const exec = await props.onExecute(selectedTool, adapted, overrideKey);
      const durationMs = performance.now() - startedAt;
      const detectedJob = exec.jobId ?? extractJobId(exec.body);
      const status: Ps72LifecycleState = exec.denied || exec.httpStatus >= 400 ? "failed" : detectedJob ? "queued" : "succeeded";
      const clientGenerated = exec.clientGenerated ?? (!exec.correlationId || !exec.requestId);
      setResult(exec.body);
      setDenied(exec.denied || exec.httpStatus >= 400);
      setJobId(detectedJob);
      setMeta({
        correlationId: exec.correlationId && exec.correlationId.trim() ? exec.correlationId : `client-${crypto.randomUUID()}`,
        requestId: exec.requestId && exec.requestId.trim() ? exec.requestId : `client-${crypto.randomUUID()}`,
        durationMs,
        status,
        clientGenerated,
      });
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      setResult({ error: error instanceof Error ? error.message : String(error) });
      setDenied(true);
      setJobId(null);
      setMeta({
        correlationId: `client-${crypto.randomUUID()}`,
        requestId: `client-${crypto.randomUUID()}`,
        durationMs,
        status: "failed",
        clientGenerated: true,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div data-testid="mcp-console-page" className="flex min-w-0 max-w-full flex-col gap-3 overflow-x-hidden">
      {/* §1 header: title + status badge + Docs link */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">MCP Console</h1>
          <Ps72HealthBadge state={props.health} testId="mcp-console-status-badge" />
        </div>
        <a data-testid="mcp-console-docs-link" href={props.docsHref} className="text-sm font-medium text-sky-700 hover:underline">
          Docs
        </a>
      </div>

      <div className="grid min-w-0 grid-cols-1 rounded-md border bg-background lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* §1/§3 left scrolling tool list with search */}
        <div className="min-w-0 border-b p-3 lg:border-b-0 lg:border-r">
          <Input
            data-testid="mcp-console-tool-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools..."
            aria-label="Search tools"
          />
          <div className="mt-1 text-xs text-slate-500">
            {props.tools.length} tools (<span data-testid="mcp-console-tool-count">{props.tools.length}</span>)
          </div>
          <ul data-testid="mcp-console-tool-list" className="mt-2 max-h-[32rem] space-y-1 overflow-y-auto" aria-label="Available tools">
            {filteredTools.map((tool) => {
              const locked = tool.bound === false;
              return (
                <li key={tool.name}>
	                  <button
	                    type="button"
	                    data-testid={`mcp-console-tool-${tool.name}`}
	                    data-locked={locked ? "true" : "false"}
	                    title={locked ? "You are not bound to this tool. Ask an administrator." : tool.description}
                    className={`w-full overflow-hidden text-ellipsis rounded-md px-2 py-1 text-left text-sm hover:bg-muted/50 ${
	                      tool.name === selectedTool ? "bg-primary/10 font-medium" : ""
                    } ${locked ? "cursor-not-allowed text-slate-600" : ""}`}
                    onClick={() => selectTool(tool)}
                  >
                    {locked ? "Locked: " : ""}
                    {tool.name}
                  </button>
                </li>
              );
            })}
            {filteredTools.length === 0 ? <li className="text-sm text-muted-foreground">No tools match your search.</li> : null}
          </ul>
        </div>

        {/* §1 centre: request editor → apikey → submit → result+meta (same card) */}
        <div className="min-w-0 space-y-3 p-4">
          <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{props.endpointUrl}</div>

          {props.extensionSlot ? (
            <div data-testid="mcp-console-extension-slot" className="rounded-md border bg-muted/20 p-3">
              {props.extensionSlot}
            </div>
          ) : null}

	          <label data-testid="mcp-console-request-label" className="block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="mcp-console-request-editor-input">
            Request
          </label>
	          <label
	            id="mcp-console-request-editor"
	            data-testid="mcp-console-request-editor"
	            className="block"
	          >
	            <span className="sr-only">Request JSON</span>
	            <textarea
	              id="mcp-console-request-editor-input"
	              value={requestText}
	              onChange={(event) => {
	                setRequestText(event.target.value);
	                setRequestDirty(true);
	              }}
	              readOnly={activeLocked}
	              aria-label="Request"
	              className="h-[220px] w-full resize-y rounded-md border bg-card p-3 font-mono text-sm text-card-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary/40"
	            />
	          </label>

          <Ps72ApiKeyField
            testIdPrefix="mcp-console"
            boundLabel={props.boundLabel}
            hasBoundKey={props.hasBoundKey}
            overrideValue={overrideKey}
            onOverrideChange={setOverrideKey}
          />

          {overrideKey.trim() ? <p className="text-xs text-amber-700">Submitting as admin override.</p> : null}

          <Button data-testid="mcp-console-submit" onClick={submit} disabled={running || !selectedTool || activeLocked}>
            {running ? "Submitting…" : "Submit"}
          </Button>

          <Ps72ResultMeta
            testIdPrefix="mcp-console"
            result={result}
            meta={meta}
            denied={denied}
            jobId={jobId}
            jobsHref={props.jobsHref}
          />
        </div>
      </div>
    </div>
  );
}
