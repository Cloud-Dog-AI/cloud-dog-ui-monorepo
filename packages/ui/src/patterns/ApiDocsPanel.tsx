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
}>;

export type A2aSkillDoc = Readonly<{
  name: string;
  description: string;
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

export function ApiDocsPanel(props: ApiDocsPanelProps) {
  const useLegacyIframe =
    props.mode === undefined &&
    props.mcpTools === undefined &&
    props.a2aSkills === undefined &&
    props.readmeContent === undefined &&
    props.readmeTitle === undefined;

  const [tab, setTab] = React.useState("api");
  const mode = props.mode ?? "swagger";
  const hasMcpTools = Boolean(props.mcpTools?.length);
  const hasA2aSkills = Boolean(props.a2aSkills?.length);
  const hasReadme = Boolean(props.readmeContent);

  const apiReference = mode === "iframe" ? (
    renderIframe(props.openapiUrl)
  ) : mode === "redoc" ? (
    <div className="min-h-[600px] overflow-auto">
      <React.Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading API documentation...</div>}>
        <LazyRedocStandalone specUrl={props.openapiUrl} />
      </React.Suspense>
    </div>
  ) : (
    <div className="min-h-[600px] overflow-auto">
      <SwaggerUI url={props.openapiUrl} />
    </div>
  );

  const toolColumns = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (tool: McpToolDoc) => <span className="font-medium">{tool.name}</span>,
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
        id: "parameters",
        header: "Parameters",
        cell: (tool: McpToolDoc) => (
          <pre className="max-w-[24rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-xs">
            {formatParameters(tool.parameters)}
          </pre>
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
        cell: (skill: A2aSkillDoc) => <span className="font-medium">{skill.name}</span>,
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
    ],
    [],
  );

  if (useLegacyIframe) {
    return (
      <Card className={cn("overflow-hidden", props.className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">API Reference</h2>
            {(props.links ?? []).map((link, index) => (
              <a
                key={`${link.href}-${index}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">{renderIframe(props.openapiUrl)}</CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">API Reference</h2>
          {(props.links ?? []).map((link, index) => (
            <a
              key={`${link.href}-${index}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="api">API Reference</TabsTrigger>
            {hasMcpTools ? <TabsTrigger value="mcp-tools">MCP Tools</TabsTrigger> : null}
            {hasA2aSkills ? <TabsTrigger value="a2a-skills">A2A Skills</TabsTrigger> : null}
            {hasReadme ? <TabsTrigger value="readme">README</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="api">
            {(props.links ?? []).length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {(props.links ?? []).map((link, index) => (
                  <a
                    key={`panel-${link.href}-${index}`}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
            {apiReference}
          </TabsContent>

          {hasMcpTools ? (
            <TabsContent value="mcp-tools">
              <h3 className="mb-3 text-lg font-semibold">MCP Tools</h3>
              <DataTable
                columns={toolColumns}
                rows={props.mcpTools ?? []}
                getRowId={(tool) => tool.name}
                emptyMessage="No MCP tools documented."
              />
            </TabsContent>
          ) : null}

          {hasA2aSkills ? (
            <TabsContent value="a2a-skills">
              <h3 className="mb-3 text-lg font-semibold">A2A Skills</h3>
              <DataTable
                columns={skillColumns}
                rows={props.a2aSkills ?? []}
                getRowId={(skill) => skill.name}
                emptyMessage="No A2A skills documented."
              />
            </TabsContent>
          ) : null}

          {hasReadme ? (
            <TabsContent value="readme">
              <DocumentViewer
                content={props.readmeContent ?? ""}
                format="markdown"
                title={props.readmeTitle ?? "README"}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </CardContent>
    </Card>
  );
}
