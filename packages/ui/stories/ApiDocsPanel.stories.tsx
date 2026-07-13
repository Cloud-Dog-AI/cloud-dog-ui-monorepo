import * as React from "react";
import { ApiDocsPanel } from "../src/patterns/ApiDocsPanel";

export default { title: "Patterns/ApiDocsPanel", component: ApiDocsPanel };

export const Canonical = {
  args: {
    openapiUrl: "/openapi.json",
    mode: "swagger",
    links: [
      { label: "OpenAPI JSON", href: "/openapi.json" },
      { label: "MCP Console", href: "/developer/mcp-console" },
      { label: "A2A Console", href: "/developer/a2a-console" },
    ],
    mcpTools: [
      {
        name: "list_jobs",
        description: "List recent jobs.",
        parameters: { type: "object", properties: { limit: { type: "integer" } } },
        exampleInput: { limit: 10 },
        exampleOutput: { jobs: [] },
      },
    ],
    a2aSkills: [
      {
        name: "run_report",
        description: "Generate a developer report.",
        inputSchema: { type: "object", properties: { reportId: { type: "string" } } },
        exampleInput: { reportId: "daily" },
      },
    ],
    readmeTitle: "Service README",
    readmeContent: "# Service README\n\nDeveloper-facing setup and operations notes.",
    extraTabs: [
      {
        id: "schema",
        label: "Schema",
        content: <pre className="rounded border bg-muted/30 p-3 text-xs">{JSON.stringify({ version: 1 }, null, 2)}</pre>,
      },
    ],
  },
};

export const Unavailable = {
  args: {
    openapiUrl: "/openapi.json",
    mode: "iframe",
    loading: true,
    openapiError: "HTTP 503",
    mcpError: "HTTP 401",
    a2aError: "HTTP 404",
  },
};
