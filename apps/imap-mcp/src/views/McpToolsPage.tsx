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

// @cloud-dog/app-imap-mcp — PS-72 MCP console: ToolBrowser + shared McpConsole only.

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  McpConsole,
  Spinner,
  ToolBrowser,
  type McpToolDef,
  type ToolDef,
} from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";

export function McpToolsPage() {
  const { api, mcpBaseUrl } = useImapMcpState();
  const [tools, setTools] = React.useState<ToolDef[]>([]);
  const [mcpDefs, setMcpDefs] = React.useState<McpToolDef[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const consoleKey = React.useMemo(() => mcpDefs.map((t) => t.name).join("|") || "empty", [mcpDefs]);

  const loadTools = React.useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await api.listMcpTools();
    if (!result.ok || !result.data) {
      setError(result.errorMessage || "Failed to load MCP tools.");
      setTools([]);
      setMcpDefs([]);
      setLoading(false);
      return;
    }
    const catalogue: ToolDef[] = result.data.map((tool) => ({
      name: tool.name,
      description: tool.description || "MCP tool",
      inputSchema: tool.input_schema,
    }));
    const defs: McpToolDef[] = result.data.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
    }));
    setTools(catalogue);
    setMcpDefs(defs);
    setLoading(false);
  }, [api]);

  const moveToolToFront = React.useCallback((toolName: string) => {
    setTools((current) => {
      const selected = current.find((item) => item.name === toolName);
      if (!selected) return current;
      return [selected, ...current.filter((item) => item.name !== toolName)];
    });
    setMcpDefs((current) => {
      const selected = current.find((item) => item.name === toolName);
      if (!selected) return current;
      return [selected, ...current.filter((item) => item.name !== toolName)];
    });
  }, []);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const endpointUrl = `${mcpBaseUrl.replace(/\/$/, "")}/messages`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">MCP Tools</h1>
        <p className="text-sm text-muted-foreground">
          Browse the MCP tool catalogue and execute tools via the shared <code className="text-xs">McpConsole</code> (PS-72).
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Tool catalogue</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />
              Loading tools…
            </div>
          ) : tools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCP tools registered for this server.</p>
          ) : (
            <ToolBrowser tools={tools} onSelect={(t) => moveToolToFront(t.name)} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">MCP console</h2>
          <p className="text-sm text-muted-foreground">
            Selecting a tool in the catalogue moves it to the top of the console so parameters match your selection.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />
              Loading tools…
            </div>
          ) : (
            <McpConsole
              key={consoleKey}
              endpointUrl={endpointUrl}
              tools={mcpDefs}
              onExecute={async (toolName, args) => {
                const r = await api.callMcpTool(toolName, args as Record<string, unknown>);
                if (!r.ok) {
                  return { error: r.errorMessage ?? "Tool call failed", status: r.meta.status };
                }
                return r.raw;
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
