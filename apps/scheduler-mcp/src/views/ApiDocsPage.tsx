// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1404e — PS-74 canonical API documentation page.
//
// Replaces the P3 stub (two clickable links) with the canonical
// @cloud-dog/ui ApiDocsPanel in swagger mode. Lazy-loads swagger-ui so
// the bundle baseline stays small (AGENT-LESSONS §6.29 — redoc/swagger
// pulled in via dynamic import inside ApiDocsPanel).

import * as React from "react";
import { ApiDocsPanel } from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { PageHeader } from "../lib/ui";

export function ApiDocsPage() {
  const { apiBaseUrl } = useAppState();
  const openapiUrl = `${apiBaseUrl}/openapi.json`;
  return (
    <div className="p-6 space-y-4" data-testid="api-docs-page">
      <PageHeader title="API Documentation" description="OpenAPI spec rendered as swagger UI (PS-74)" />
      <ApiDocsPanel
        openapiUrl={openapiUrl}
        mode="swagger"
        links={[
          { label: "Raw OpenAPI JSON", href: openapiUrl },
          { label: "MCP Console", href: "/developer/mcp-console" },
          { label: "A2A Console", href: "/developer/a2a-console" },
        ]}
      />
    </div>
  );
}
