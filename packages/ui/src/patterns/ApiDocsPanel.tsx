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

// @cloud-dog/ui — ApiDocsPanel pattern (embedded OpenAPI docs with links).

/// <reference path="../types/swagger-ui-react.d.ts" />

import * as React from "react";
import SwaggerUI from "swagger-ui-react";
import { cn } from "../utils/cn";
import { Card, CardContent, CardHeader } from "../components/card/Card";
import { DataTable } from "../components/table/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs/Tabs";
import { DocumentViewer } from "./DocumentViewer";
import { WorkedExamplePopup } from "./WorkedExamplePopup";

// Lazy-load redoc so that its transitive dependencies (mobx, styled-components)
// are only pulled in at runtime when mode="redoc" is actually used.
// This prevents build failures in apps that never use redoc mode.
// The computed module name ("re" + "doc") prevents Rollup from statically
// resolving and bundling the import — it remains a true runtime-only import.
const redocModuleName = "re" + "doc";
const LazyRedocStandalone = React.lazy(() =>
  import(/* @vite-ignore */ redocModuleName).then((mod: { RedocStandalone: React.ComponentType<{ specUrl: string }> }) => ({
    default: mod.RedocStandalone,
  })),
);

export type ApiDocLink = Readonly<{
  label: string;
  href: string;
}>;

export type ApiDocsMode = "swagger" | "redoc" | "iframe";

export type McpToolDoc = Readonly<{
  name: string;
  description: string;
  parameters?: unknown;
  exampleInput?: unknown;
  exampleOutput?: unknown;
  authNote?: string;
}>;

export type A2aSkillDoc = Readonly<{
  name: string;
  description: string;
  inputSchema?: unknown;
  exampleInput?: unknown;
  exampleOutput?: unknown;
  authNote?: string;
}>;

export type ApiDocsExtraTab = Readonly<{
  id: string;
  label: string;
  content: React.ReactNode;
  testId?: string;
}>;

export type ApiDocsPanelProps = Readonly<{
  openapiUrl: string;
  links?: ApiDocLink[];
  className?: string;
  mode?: ApiDocsMode;
  mcpTools?: McpToolDoc[];
  a2aSkills?: A2aSkillDoc[];
  readmeContent?: string;
  readmeTitle?: string;
  loading?: boolean;
  openapiError?: string | null;
  mcpError?: string | null;
  a2aError?: string | null;
  extraTabs?: ApiDocsExtraTab[];
  testIdPrefix?: string;
}>;

function renderIframe(openapiUrl: string) {
  return (
    <iframe
      src={openapiUrl}
      title="API documentation"
      className="h-[600px] w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

function formatParameters(parameters: unknown): string {
  if (parameters == null) {
    return "None";
  }
  if (typeof parameters === "string") {
    return parameters;
  }
  try {
    return JSON.stringify(parameters, null, 2);
  } catch {
    return String(parameters);
  }
}

function firstExampleFromSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  const record = schema as Record<string, unknown>;
  if (Array.isArray(record.examples) && record.examples.length > 0) return record.examples[0];
  if (record.example !== undefined) return record.example;
  const properties = record.properties && typeof record.properties === "object"
    ? (record.properties as Record<string, Record<string, unknown>>)
    : {};
  const template = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      if ("default" in value) return [key, value.default];
      if (Array.isArray(value.enum) && value.enum.length > 0) return [key, value.enum[0]];
      switch (value.type) {
        case "number":
        case "integer":
          return [key, 0];
        case "boolean":
          return [key, false];
        case "array":
          return [key, []];
        case "object":
          return [key, {}];
        default:
          return [key, ""];
      }
    }),
  );
  return Object.keys(template).length > 0 ? template : undefined;
}

export function ApiDocsPanel(props: ApiDocsPanelProps) {
  const swaggerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = React.useState("api");
  const [workedExample, setWorkedExample] = React.useState<{
    title: string;
    description?: string;
    input?: unknown;
    output?: unknown;
    endpointUrl?: string;
  } | null>(null);
  const mode = props.mode ?? "swagger";
  const testIdPrefix = props.testIdPrefix ?? "api-docs";
  const testId = React.useCallback((suffix: string) => `${testIdPrefix}-${suffix}`, [testIdPrefix]);

  React.useEffect(() => {
    if (mode !== "swagger") return;
    const root = swaggerContainerRef.current;
    if (!root) return;

    const labelServerSelect = () => {
      const select = root.querySelector<HTMLSelectElement>("select#servers");
      if (!select) return;
      select.setAttribute("aria-label", "OpenAPI server");
      select.setAttribute("title", "OpenAPI server");
    };

    labelServerSelect();
    const observer = new MutationObserver(labelServerSelect);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mode, props.openapiUrl]);

  const apiReference = props.openapiError ? (
    <div
      className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
      role="alert"
      data-testid={testId("openapi-error")}
    >
      OpenAPI specification is unavailable. Check the service OpenAPI endpoint and retry. {props.openapiError}
    </div>
  ) : mode === "iframe" ? (
    <div data-testid={testId("openapi-frame")}>{renderIframe(props.openapiUrl)}</div>
  ) : mode === "redoc" ? (
    <div className="min-h-[600px] overflow-auto" data-testid={testId("openapi-redoc")}>
      <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading API documentation...</div>}>
        <LazyRedocStandalone specUrl={props.openapiUrl} />
      </React.Suspense>
    </div>
  ) : (
    <div ref={swaggerContainerRef} className="min-h-[600px] overflow-auto" data-testid={testId("openapi-swagger")}>
      <SwaggerUI url={props.openapiUrl} />
    </div>
  );

  const toolColumns = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (tool: McpToolDoc) => (
          <button
            type="button"
            className="text-left font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setWorkedExample({
              title: tool.name,
              description: tool.description,
              input: tool.exampleInput ?? firstExampleFromSchema(tool.parameters),
              output: tool.exampleOutput ?? { ok: true, result: {} },
              endpointUrl: "/mcp/messages",
            })}
          >
            {tool.name}
          </button>
        ),
        sortable: true,
        sortValue: (tool: McpToolDoc) => tool.name,
      },
      {
        id: "description",
        header: "Description",
        cell: (tool: McpToolDoc) => (
          <div className="max-w-[34rem] whitespace-pre-wrap text-sm text-muted-foreground">
            {tool.description}
          </div>
        ),
      },
      {
        id: "example",
        header: "Example curl / output",
        cell: (tool: McpToolDoc) => (
          <div className="space-y-2">
            <pre className="max-w-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">
              {`curl -sk -X POST /mcp/messages \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ tool: tool.name, input: tool.exampleInput ?? firstExampleFromSchema(tool.parameters) ?? {} })}'`}
            </pre>
            <pre className="max-w-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">
              {JSON.stringify(tool.exampleOutput ?? { ok: true, result: {} }, null, 2)}
            </pre>
            <p className="text-xs text-muted-foreground">{tool.authNote ?? "Requires authenticated operator session."}</p>
            <details>
              <summary className="cursor-pointer text-xs text-primary">Parameter schema</summary>
              <pre className="mt-1 max-w-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">
                {formatParameters(tool.parameters)}
              </pre>
            </details>
          </div>
        ),
      },
    ],
    [],
  );

  const skillColumns = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (skill: A2aSkillDoc) => (
          <button
            type="button"
            className="text-left font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setWorkedExample({
              title: skill.name,
              description: skill.description,
              input: skill.exampleInput ?? firstExampleFromSchema(skill.inputSchema) ?? { topic: skill.name, payload: {} },
              output: skill.exampleOutput ?? { response: "ok" },
              endpointUrl: "/a2a",
            })}
          >
            {skill.name}
          </button>
        ),
        sortable: true,
        sortValue: (skill: A2aSkillDoc) => skill.name,
      },
      {
        id: "description",
        header: "Description",
        cell: (skill: A2aSkillDoc) => (
          <div className="max-w-[40rem] whitespace-pre-wrap text-sm text-muted-foreground">
            {skill.description}
          </div>
        ),
      },
      {
        id: "example",
        header: "Example curl / output",
        cell: (skill: A2aSkillDoc) => (
          <div className="space-y-2">
            <pre className="max-w-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">
              {`curl -sk -X POST /a2a \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(skill.exampleInput ?? firstExampleFromSchema(skill.inputSchema) ?? { topic: skill.name, payload: {} })}'`}
            </pre>
            <pre className="max-w-[28rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">
              {JSON.stringify(skill.exampleOutput ?? { response: "ok" }, null, 2)}
            </pre>
            <p className="text-xs text-muted-foreground">{skill.authNote ?? "Requires authenticated operator session."}</p>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <Card className={cn("overflow-hidden", props.className)} data-testid={testId("panel")}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-3" data-testid={testId("links")}>
          <h2 className="text-sm font-semibold">API Reference</h2>
          {(props.links ?? []).map((link, index) => (
            <a
              key={`${link.href}-${index}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
              data-testid={testId(`link-${index}`)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {props.loading ? (
          <div className="mb-3 text-sm text-muted-foreground" role="status" data-testid={testId("loading")}>
            Loading API documentation...
          </div>
        ) : null}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap" data-testid={testId("tabs")}>
            <TabsTrigger value="api" data-testid={testId("tab-api")}>API Reference</TabsTrigger>
            <TabsTrigger value="mcp" data-testid={testId("tab-mcp")}>MCP Reference</TabsTrigger>
            <TabsTrigger value="a2a" data-testid={testId("tab-a2a")}>A2A Reference</TabsTrigger>
            <TabsTrigger value="readme" data-testid={testId("tab-readme")}>README</TabsTrigger>
            {(props.extraTabs ?? []).map((extra) => (
              <TabsTrigger key={extra.id} value={extra.id} data-testid={extra.testId ?? testId(`tab-${extra.id}`)}>
                {extra.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* IMAP-441: links removed from the api-tab body — duplicate of CardHeader links. */}
          <TabsContent value="api" data-testid={testId("panel-api")}>{apiReference}</TabsContent>

          <TabsContent value="mcp" data-testid={testId("panel-mcp")}>
            <h3 className="mb-3 text-lg font-semibold">MCP Reference</h3>
            {props.mcpError ? (
              <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert" data-testid={testId("mcp-error")}>
                MCP reference is unavailable. {props.mcpError}
              </p>
            ) : null}
            <DataTable
              tableId="api-docs-mcp-reference"
              ariaLabel="MCP tool reference"
              columns={toolColumns}
              rows={props.mcpTools ?? []}
              getRowId={(tool) => tool.name}
              columnPickerEnabled
              selectable
              bulkActions={[{ label: "Export", action: "export" }]}
              onBulkAction={(_, selectedIds) => {
                const selected = (props.mcpTools ?? []).filter((tool) => selectedIds.includes(tool.name));
                const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "mcp-reference.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              emptyMessage="No MCP tools documented."
            />
          </TabsContent>

          <TabsContent value="a2a" data-testid={testId("panel-a2a")}>
            <h3 className="mb-3 text-lg font-semibold">A2A Reference</h3>
            {props.a2aError ? (
              <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert" data-testid={testId("a2a-error")}>
                A2A reference is unavailable. {props.a2aError}
              </p>
            ) : null}
            <DataTable
              tableId="api-docs-a2a-reference"
              ariaLabel="A2A skill reference"
              columns={skillColumns}
              rows={props.a2aSkills ?? []}
              getRowId={(skill) => skill.name}
              columnPickerEnabled
              selectable
              bulkActions={[{ label: "Export", action: "export" }]}
              onBulkAction={(_, selectedIds) => {
                const selected = (props.a2aSkills ?? []).filter((skill) => selectedIds.includes(skill.name));
                const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "a2a-reference.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
              emptyMessage="No A2A skills documented."
            />
          </TabsContent>

          <TabsContent value="readme" data-testid={testId("panel-readme")}>
            <DocumentViewer
              content={props.readmeContent ?? "README content is not available for this service."}
              format="markdown"
              title={props.readmeTitle ?? "README"}
            />
          </TabsContent>
          {(props.extraTabs ?? []).map((extra) => (
            <TabsContent key={extra.id} value={extra.id} data-testid={extra.testId ? `${extra.testId}-panel` : testId(`panel-${extra.id}`)}>
              {extra.content}
            </TabsContent>
          ))}
        </Tabs>
        <WorkedExamplePopup
          open={workedExample !== null}
          onOpenChange={(open) => { if (!open) setWorkedExample(null); }}
          title={workedExample?.title ?? "Worked example"}
          description={workedExample?.description}
          exampleInput={workedExample?.input}
          exampleOutput={workedExample?.output}
          endpointUrl={workedExample?.endpointUrl}
        />
      </CardContent>
    </Card>
  );
}
