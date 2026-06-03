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

// @cloud-dog/app-index-retriever — MCP catalogue and tool execution panel.

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import { Badge, Button, Card, CardContent, CardHeader, JsonBlock, McpConsole } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord, ToolDescriptor } from "../lib/types";

type RuntimeConfig = Readonly<{
  MCP_BASE_URL?: string;
}>;

function injectProfileCollectionDefaults(
  schema: JsonRecord | undefined,
  profile: string,
  collection: string,
): JsonRecord | undefined {
  if (!schema || typeof schema !== "object") return schema;
  const properties = schema.properties as JsonRecord | undefined;
  if (!properties || typeof properties !== "object") return schema;
  const patched = { ...schema, properties: { ...properties } };
  const props = patched.properties as Record<string, JsonRecord>;
  if (props.profile && typeof props.profile === "object") {
    props.profile = { ...props.profile, default: profile };
  }
  if (props.collection && typeof props.collection === "object") {
    props.collection = { ...props.collection, default: collection };
  }
  return patched;
}

export function McpConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();

  const [tools, setTools] = React.useState<ToolDescriptor[]>([]);
  const [lastResponse, setLastResponse] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const loadTools = React.useCallback(async () => {
    setError(null);
    try {
      const list = await app.api.listTools();
      setTools(list);
      setStatus(`Loaded ${list.length} tool(s)`);
      app.recordActivity("mcp.tools_list", "ok", String(list.length));
    } catch (loadError) {
      const message = app.captureFailure(loadError);
      setError(message);
      setStatus("");
      app.recordActivity("mcp.tools_list", "error", message);
    }
  }, [app]);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const execute = async (toolName: string, args: unknown) => {
    const payload = args && typeof args === "object" && !Array.isArray(args) ? (args as JsonRecord) : {};
    const result = await app.api.callTool(toolName, payload);
    setLastResponse(result);
    setStatus(`Executed ${toolName}`);
    app.recordActivity(`mcp.${toolName}`, "ok");
    return result;
  };

  const endpointUrl = cfg.MCP_BASE_URL?.trim() || `${window.location.origin}/mcp`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">MCP Console</h1>
          <p className="text-sm text-muted-foreground">
            Browse the MCP catalogue and execute tool calls through the shared console.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadTools()}>
          Load Tool Catalogue
        </Button>
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
            <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">api_key</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">MCP endpoint: <code className="text-xs">{endpointUrl}</code> — Authenticated via web proxy session.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Active context: profile=<code className="text-xs">{app.sourceConfig.profile}</code>{" "}
            collection=<code className="text-xs">{app.sourceConfig.collection || "(none)"}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">MCP Catalogue and Tool Calls</h2>
        </CardHeader>
        <CardContent>
          <McpConsole
            endpointUrl={endpointUrl}
            tools={tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: injectProfileCollectionDefaults(
                tool.input_schema,
                app.sourceConfig.profile,
                app.sourceConfig.collection,
              ),
            }))}
            onExecute={execute}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Tool response</h2>
        </CardHeader>
        <CardContent>
          <JsonBlock title="response" value={lastResponse ?? {}} />
        </CardContent>
      </Card>
    </div>
  );
}
