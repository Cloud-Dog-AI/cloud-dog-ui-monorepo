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

// @cloud-dog/ui — McpConsole pattern (MCP test console).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Select } from "../components/input/Select";
import { Textarea } from "../components/input/Textarea";
import { JsonBlock } from "./JsonBlock";
import { RelativeTime } from "./RelativeTime";

export type McpToolDef = Readonly<{
  name: string;
  description?: string;
  inputSchema?: unknown;
}>;

type HistoryEntry = Readonly<{
  id: string;
  tool: string;
  args: unknown;
  result: unknown;
  timestamp: string;
}>;

export type McpConsoleProps = Readonly<{
  endpointUrl: string;
  tools: McpToolDef[];
  onExecute: (toolName: string, args: unknown) => Promise<unknown>;
  className?: string;
}>;

function templateValueForProperty(value: Record<string, unknown>): unknown {
  if ("default" in value) {
    return value.default;
  }
  if (Array.isArray(value.enum) && value.enum.length > 0) {
    return value.enum[0];
  }

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

function buildArgsTemplate(tool: McpToolDef): Record<string, unknown> {
  const schema =
    tool.inputSchema && typeof tool.inputSchema === "object"
      ? (tool.inputSchema as Record<string, unknown>)
      : {};
  const properties =
    schema.properties && typeof schema.properties === "object"
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {};

  const template = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, templateValueForProperty(value)])
  );

  if (
    tool.name === "query_database"
    && (typeof template.question !== "string" || template.question.trim() === "")
  ) {
    template.question = "Which database tables are available?";
  }

  return template;
}

export function McpConsole(props: McpConsoleProps) {
  const [selectedTool, setSelectedTool] = React.useState(props.tools[0]?.name ?? "");
  const [query, setQuery] = React.useState("");
  const [argsText, setArgsText] = React.useState("{}");
  const [running, setRunning] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);

  const filteredTools = React.useMemo(() => {
    const nextQuery = query.trim().toLowerCase();
    if (!nextQuery) {
      return props.tools;
    }
    return props.tools.filter((tool) => {
      const description = typeof tool.description === "string" ? tool.description : "";
      return (
        tool.name.toLowerCase().includes(nextQuery)
        || description.toLowerCase().includes(nextQuery)
      );
    });
  }, [props.tools, query]);

  const activeTool = props.tools.find((t) => t.name === selectedTool);

  React.useEffect(() => {
    if (filteredTools.some((tool) => tool.name === selectedTool)) {
      return;
    }
    setSelectedTool(filteredTools[0]?.name ?? "");
  }, [filteredTools, selectedTool]);

  React.useEffect(() => {
    if (!activeTool) return;
    setArgsText(JSON.stringify(buildArgsTemplate(activeTool), null, 2));
  }, [activeTool?.name]);

  const execute = async () => {
    if (!selectedTool) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(argsText);
    } catch {
      return;
    }
    setRunning(true);
    try {
      setArgsText("{}");
      const result = await props.onExecute(selectedTool, parsed);
      setHistory((h) => [
        { id: crypto.randomUUID(), tool: selectedTool, args: parsed, result, timestamp: new Date().toISOString() },
        ...h,
      ]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={cn("flex rounded-md border bg-background", props.className)}>
      {/* Tool sidebar */}
      <div className="w-56 shrink-0 border-r p-3 space-y-2">
        <h2 className="text-sm font-semibold">Tool Browser</h2>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools..."
          aria-label="Search tools"
        />
        <ul className="space-y-1" aria-label="Available tools">
          {filteredTools.map((t) => (
            <li key={t.name}>
              <button
                type="button"
                className={cn(
                  "w-full text-left text-sm rounded-md px-2 py-1 hover:bg-muted/50",
                  t.name === selectedTool ? "bg-primary/10 font-medium" : "",
                )}
                onClick={() => setSelectedTool(t.name)}
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        {filteredTools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tools match your search.</p>
        ) : null}
      </div>

      {/* Main panel */}
      <div className="flex-1 min-w-0 p-4 space-y-4">
        <h2 className="text-sm font-semibold">Tool execution</h2>
        <div className="text-xs text-muted-foreground">{props.endpointUrl}</div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tool Name
          </label>
          <Select
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
            aria-label="Select tool"
          >
            {props.tools.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </Select>
          {activeTool?.description ? (
            <p className="text-xs text-muted-foreground">{activeTool.description}</p>
          ) : null}
        </div>

        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parameters (JSON)
        </label>
        <Textarea
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          placeholder='{"key": "value"}'
          className="font-mono text-xs"
          aria-label="Arguments JSON"
          rows={5}
        />

        <Button onClick={execute} disabled={running || !selectedTool}>
          {running ? "Running..." : "Execute"}
        </Button>

        {/* History */}
        {history.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm font-semibold">History</div>
            {history.map((entry, index) => (
              <div key={entry.id} className="space-y-1">
                <div className="text-sm font-semibold">Response</div>
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold">{entry.tool} @</span>
                  <RelativeTime timestamp={entry.timestamp} className="text-muted-foreground" />
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(entry.result, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${entry.tool}-${entry.timestamp.replace(/[:.]/g, "-")}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </button>
                </div>
                <JsonBlock title={entry.tool} value={entry.result} defaultCollapsed={index > 0} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
