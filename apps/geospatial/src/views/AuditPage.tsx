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

// Audit Log (CW-L9). Backed by the geospatial /api/audit endpoint (reads the platform
// cloud_dog_logging audit sink) through the shared @cloud-dog/ui LogTablePanel.

import * as React from "react";
import {
  DiagnosticsHealthPanel,
  LogTablePanel,
  type AuditLogEntry,
  type DiagnosticsHealthItem,
  type LogApiAdapter,
} from "@cloud-dog/ui";
import { PageHeader } from "../lib/ui";
import { useGeoState } from "../state/AppState";
import type { GeoApi } from "../lib/api";

// PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): map an api-kit health probe
// result to the canonical ok/warning/error/unknown vocabulary.
function probeStatus(resolved: Record<string, unknown> | null, failed: boolean): DiagnosticsHealthItem["status"] {
  if (failed) return "error";
  if (!resolved) return "unknown";
  const raw = String(resolved.status ?? resolved.state ?? "").toLowerCase();
  if (raw.includes("degrad") || raw.includes("warn") || raw.includes("partial")) return "warning";
  if (raw.includes("fail") || raw.includes("error") || raw.includes("down")) return "error";
  return "ok";
}

// Probe the geospatial service/MCP/A2A health surfaces for the diagnostics panel.
function useGeoHealth(api: GeoApi) {
  const [health, setHealth] = React.useState<DiagnosticsHealthItem[]>([
    { name: "API", status: "unknown" },
    { name: "MCP", status: "unknown" },
    { name: "A2A", status: "unknown" },
  ]);
  const [error, setError] = React.useState<string | null>(null);

  const probe = React.useCallback(
    async (name: string, fn: () => Promise<Record<string, unknown>>): Promise<DiagnosticsHealthItem> => {
      try {
        const res = await fn();
        return { name, status: probeStatus(res, false) };
      } catch {
        return { name, status: "error", detail: "Health probe failed" };
      }
    },
    [],
  );

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const [apiH, mcpH, a2aH] = await Promise.all([
        probe("API", api.health),
        probe("MCP", api.mcpHealth),
        probe("A2A", api.a2aHealth),
      ]);
      setHealth([apiH, mcpH, a2aH]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load service health.");
    }
  }, [api, probe]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { health, healthError: error, refreshHealth: refresh };
}

const SURFACES = [
  { id: "audit", label: "Audit" },
  { id: "api", label: "API" },
  { id: "web", label: "Web" },
  { id: "mcp", label: "MCP" },
  { id: "a2a", label: "A2A" },
];

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Map a geospatial audit event (cloud_dog_logging JSONL shape) to the shared AuditLogEntry. */
function toAuditLogEntry(event: Record<string, unknown>, index: number): AuditLogEntry {
  const actor = asObj(event.actor);
  const target = asObj(event.target);
  const ts = str(event.timestamp) ?? "";
  return {
    id: str(event.event_id) ?? str(event.request_id) ?? str(event.correlation_id) ?? `evt-${index}-${ts}`,
    timestamp: ts,
    event_type: str(event.event_type),
    action: str(event.action),
    outcome: str(event.outcome),
    severity: str(event.severity),
    level: str(event.severity),
    message: str(event.message),
    trace_id: str(event.trace_id) ?? str(event.correlation_id),
    request_id: str(event.request_id),
    service: str(event.service),
    service_instance: str(event.service_instance),
    environment: str(event.environment),
    surface: "audit",
    surface_label: "Audit",
    source_path: null,
    logger: null,
    actor: {
      type: str(actor.type),
      id: str(actor.id),
      ip: str(actor.ip),
      roles: Array.isArray(actor.roles) ? (actor.roles as string[]) : null,
      user_agent: null,
    },
    target: {
      type: str(target.type),
      id: str(target.id),
      name: str(target.name),
      path: null,
    },
    details: (event.details as Record<string, unknown> | null) ?? null,
  };
}

function createLogAdapter(api: GeoApi): LogApiAdapter {
  return {
    async getLogs(params) {
      // The geospatial backend exposes a single audit stream; non-audit surfaces return empty.
      if (params.surface && params.surface !== "audit") {
        return { entries: [], count: 0, available_surfaces: SURFACES };
      }
      const events = await api.auditEvents(params.limit ?? 100);
      const entries = events.map(toAuditLogEntry);
      return { entries, count: entries.length, available_surfaces: SURFACES };
    },
  };
}

export function AuditPage() {
  const { api, appVersion } = useGeoState();
  const adapter = React.useMemo(() => createLogAdapter(api), [api]);
  const { health, healthError, refreshHealth } = useGeoHealth(api);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" version={appVersion} description="NIST AU-3 structured audit events with actor, target, outcome and correlation." />
      {/* PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): diagnostics / health /
          resource-metrics panel above the NIST AU-3 audit table. */}
      <DiagnosticsHealthPanel
        title="System diagnostics"
        description="Live resource metrics and service health for the geospatial service."
        metricsUrl="/status"
        metricsIntervalMs={30_000}
        health={health}
        error={healthError}
        onRefresh={refreshHealth}
      />
      <LogTablePanel
        api={adapter}
        tableId="geospatial-audit"
        title="Audit Log"
        description="Structured audit events per PS-40, read live from the geospatial audit sink."
        initialSurface="audit"
        limit={100}
        defaultVisibleColumns={["timestamp", "who", "eventType", "action", "target", "outcome", "severity", "traceId", "service", "inspect"]}
      />
    </div>
  );
}
