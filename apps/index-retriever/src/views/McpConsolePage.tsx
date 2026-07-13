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
import { Button, Ps72McpConsole } from "@cloud-dog/ui";
import type { Ps72HealthState } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord, ToolDescriptor } from "../lib/types";
import { maskBoundKey, ps72McpToolCall } from "../lib/ps72Console";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
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
  const { api, apiKey, captureFailure, recordActivity, sourceConfig } = app;

  const [tools, setTools] = React.useState<ToolDescriptor[]>([]);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const loadTools = React.useCallback(async () => {
    setError(null);
    try {
      const list = await api.listTools();
      setTools(list);
      setStatus(`Loaded ${list.length} tool(s)`);
      recordActivity("mcp.tools_list", "ok", String(list.length));
    } catch (loadError) {
      const message = captureFailure(loadError);
      setError(message);
      setStatus("");
      recordActivity("mcp.tools_list", "error", message);
    }
  }, [api, captureFailure, recordActivity]);

  React.useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const execute = async (toolName: string, args: unknown, overrideKey: string) => {
    const result = await ps72McpToolCall({
      apiBaseUrl: cfg.API_BASE_URL,
      toolName,
      args,
      boundApiKey: apiKey,
      overrideKey,
    });
    setStatus(`Submitted ${toolName}`);
    recordActivity(`mcp.${toolName}`, result.denied ? "error" : "ok", result.denied ? String(result.httpStatus) : undefined);
    return result;
  };

  const endpointUrl = cfg.MCP_BASE_URL?.trim() || `${window.location.origin}/mcp`;
  const health: Ps72HealthState = error ? "unhealthy" : tools.length > 0 ? "healthy" : "unknown";
  const hasBoundKey = cfg.AUTH_MODE === "api_key" ? Boolean(apiKey.trim()) : true;

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

      <Ps72McpConsole
        endpointUrl={endpointUrl}
        health={health}
        hasBoundKey={hasBoundKey}
        boundLabel={maskBoundKey(apiKey)}
        docsHref="/api-docs#mcp"
        jobsHref="/system/jobs"
        tools={tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          bound: true,
          inputSchema: injectProfileCollectionDefaults(
            tool.input_schema,
            sourceConfig.profile,
            sourceConfig.collection,
          ),
        }))}
        onExecute={execute}
      />
    </div>
  );
}
