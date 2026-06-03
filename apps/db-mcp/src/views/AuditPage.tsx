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

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { AuditPanel, LogTablePanel, ResourceMetrics, type LogApiAdapter, type AuditLogEntry, type LogEntry, type LogsResponse } from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";
import type { AuditEvent, LogEntrySummary } from "../lib/types";
import type { DbMcpApi } from "../lib/api";

const LOG_TYPES = ["api", "web", "mcp", "a2a"] as const;

function toLogEntry(item: LogEntrySummary): LogEntry {
  return {
    id: item.id,
    timestamp: item.timestamp,
    level: item.level,
    source: item.source,
    message: `${item.logger} [${item.correlation_id}] ${item.message}`,
  };
}

/** Map DB-MCP AuditEvent to the shared NIST AU-3 AuditLogEntry. */
export function auditEventToLogEntry(event: AuditEvent): AuditLogEntry {
  return {
    id: event.event_id,
    timestamp: event.timestamp,
    event_type: event.event_type,
    action: event.action ?? null,
    outcome: event.outcome ?? null,
    severity: event.severity ?? null,
    level: event.severity ?? null,
    message: null,
    trace_id: event.trace_id ?? event.correlation_id ?? null,
    request_id: event.request_id ?? null,
    service: event.service ?? null,
    service_instance: event.service_instance ?? null,
    environment: event.environment ?? null,
    surface: "audit",
    surface_label: "Audit",
    source_path: null,
    logger: null,
    actor: event.actor ? {
      type: event.actor.type ?? null,
      id: event.actor.id ?? null,
      ip: event.actor.ip ?? null,
      roles: event.actor.roles ?? null,
      user_agent: null,
    } : null,
    target: event.target ? {
      type: event.target.type ?? null,
      id: event.target.id ?? null,
      name: event.target.name ?? null,
      path: null,
    } : null,
    details: event.details ?? null,
  };
}

/** Map DB-MCP LogEntrySummary to AuditLogEntry for the application log surfaces. */
function logSummaryToAuditLogEntry(item: LogEntrySummary, surface: string): AuditLogEntry {
  return {
    id: item.id,
    timestamp: item.timestamp,
    event_type: null,
    action: null,
    outcome: null,
    severity: item.level,
    level: item.level,
    message: item.message,
    trace_id: item.correlation_id || null,
    request_id: null,
    service: null,
    service_instance: null,
    environment: null,
    surface,
    surface_label: surface.toUpperCase(),
    source_path: item.source ?? null,
    logger: item.logger,
    actor: null,
    target: null,
    details: null,
  };
}

/** Create a LogApiAdapter backed by the DB-MCP API. */
function createLogApiAdapter(api: DbMcpApi): LogApiAdapter {
  return {
    async getLogs(params) {
      if (params.surface === "audit") {
        const events = await api.listAuditEvents(params.limit);
        const entries = events.map(auditEventToLogEntry);
        return {
          entries,
          count: entries.length,
          available_surfaces: [
            { id: "audit", label: "Audit" },
            { id: "api", label: "API" },
            { id: "web", label: "Web" },
            { id: "mcp", label: "MCP" },
            { id: "a2a", label: "A2A" },
          ],
        };
      }
      const logItems = await api.listLogs(params.surface, params.limit);
      const entries = logItems.map((item) => logSummaryToAuditLogEntry(item, params.surface));
      return {
        entries,
        count: entries.length,
        available_surfaces: [
          { id: "audit", label: "Audit" },
          { id: "api", label: "API" },
          { id: "web", label: "Web" },
          { id: "mcp", label: "MCP" },
          { id: "a2a", label: "A2A" },
        ],
      };
    },
  };
}

export function AuditPage() {
  const auth = useAuth();
  const { api } = useDbMcpState();
  const [activeType, setActiveType] = React.useState<(typeof LOG_TYPES)[number]>("api");
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [autoFollow, setAutoFollow] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const logAdapter = React.useMemo(() => createLogApiAdapter(api), [api]);

  const loadStreams = React.useCallback(async () => {
    setError(null);
    try {
      const logItems = await api.listLogs(activeType, 200);
      setLogs(logItems.map(toLogEntry));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit activity.");
    }
  }, [activeType, api]);

  React.useEffect(() => {
    void loadStreams();
  }, [loadStreams]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Audit</h1>
        <p className="text-sm text-muted-foreground">Resource metrics, structured server logs, and NIST AU-3 audit events.</p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">System metrics (resource monitoring — see Settings for full health)</summary>
        <div className="mt-3">
          <ResourceMetrics
            metrics={[
              { label: "Uptime", value: "N/A", tone: "neutral" },
              { label: "Memory", value: "N/A", tone: "neutral" },
              { label: "CPU", value: "N/A", tone: "neutral" },
              { label: "Disk", value: "N/A", tone: "neutral" },
              { label: "Connections", value: "N/A", tone: "neutral" },
            ]}
            fetchUrl="/webapi/v1/metrics"
            intervalMs={30000}
            getAccessToken={() => auth.getAccessToken()}
          />
        </div>
      </details>

      <AuditPanel
        logTypes={[...LOG_TYPES]}
        activeType={activeType}
        onTypeChange={(value) => setActiveType(value as (typeof LOG_TYPES)[number])}
        logs={logs}
        onRefresh={() => void loadStreams()}
        autoFollow={autoFollow}
        onAutoFollowChange={setAutoFollow}
      />

      <LogTablePanel
        api={logAdapter}
        tableId="db-mcp-audit-nist"
        title="Audit events (NIST AU-3)"
        description="Structured audit log with actor, target, outcome, and correlation fields per PS-40."
        initialSurface="audit"
        limit={100}
        defaultVisibleColumns={["timestamp", "who", "action", "target", "outcome", "severity", "traceId", "service", "message", "inspect"]}
      />
    </div>
  );
}
