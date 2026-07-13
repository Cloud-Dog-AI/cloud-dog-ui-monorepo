// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import {
  Button,
  DataTable,
  DiagnosticsHealthPanel,
  Input,
  Select,
  StatusBadge,
  type DataColumn,
  type DiagnosticsHealthItem,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { AuditEventResponse } from "../lib/types";

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

type HealthProbes = {
  health: (path?: string) => Promise<Record<string, unknown>>;
  mcpHealth: () => Promise<Record<string, unknown>>;
  a2aHealth: () => Promise<Record<string, unknown>>;
};

function useServiceHealth(api: HealthProbes) {
  const [health, setHealth] = React.useState<DiagnosticsHealthItem[]>([
    { name: "API", status: "unknown" },
    { name: "MCP", status: "unknown" },
    { name: "A2A", status: "unknown" },
  ]);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  const probe = React.useCallback(
    async (name: string, fn: () => Promise<Record<string, unknown>>): Promise<DiagnosticsHealthItem> => {
      try {
        return { name, status: probeStatus(await fn(), false) };
      } catch {
        return { name, status: "error", detail: "Health probe failed" };
      }
    },
    [],
  );

  const refreshHealth = React.useCallback(async () => {
    setHealthError(null);
    try {
      setHealth(
        await Promise.all([
          probe("API", () => api.health()),
          probe("MCP", api.mcpHealth),
          probe("A2A", api.a2aHealth),
        ]),
      );
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Failed to load service health.");
    }
  }, [api, probe]);

  React.useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  return { health, healthError, refreshHealth };
}

export const AUDIT_EVENT_TYPES = [
  "scan_submitted",
  "scan_validated",
  "scan_queued",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "job_queued",
  "job_started",
  "job_completed",
  "job_failed",
  "job_cancelled",
  "artifact_published",
  "manifest_created",
  "finding_indexed",
  "settings_changed",
  "waiver_created",
  "waiver_updated",
  "waiver_revoked",
  "waiver_expired",
] as const;

function matchesRole(row: AuditEventResponse, role: string): boolean {
  if (!role) return true;
  const meta = row.metadata_json ?? {};
  const roles = Array.isArray(meta.roles) ? meta.roles.map(String) : [];
  return roles.includes(role) || row.caller_id === role;
}

export function AuditPage() {
  const { api, appVersion } = useSbomState();
  const { health, healthError, refreshHealth } = useServiceHealth(api);
  const [rows, setRows] = React.useState<AuditEventResponse[]>([]);
  const [eventType, setEventType] = React.useState("");
  const [scanId, setScanId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listAudit(200);
      setRows(result.items);
    } catch (e) {
      setError(errMessage(e, "Failed to load audit events."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(
    () =>
      rows.filter((row) => {
        if (eventType && row.event_type !== eventType) return false;
        if (scanId && !(row.scan_id ?? "").toLowerCase().includes(scanId.toLowerCase())) return false;
        return matchesRole(row, role);
      }),
    [eventType, role, rows, scanId]
  );

  const roles = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.caller_id) set.add(row.caller_id);
      const meta = row.metadata_json ?? {};
      if (Array.isArray(meta.roles)) meta.roles.map(String).forEach((value) => set.add(value));
    }
    return [...set].sort();
  }, [rows]);

  const columns: DataColumn<AuditEventResponse>[] = [
    { id: "seq", header: "Seq", sortable: true, sortValue: (r) => r.seq, cell: (r) => r.seq },
    { id: "event_time", header: "Time", sortable: true, sortValue: (r) => r.event_time, cell: (r) => <span className="text-xs text-muted-foreground">{r.event_time}</span> },
    { id: "event_type", header: "Event", sortable: true, sortValue: (r) => r.event_type, cell: (r) => r.event_type },
    { id: "event_result", header: "Result", sortable: true, sortValue: (r) => r.event_result, cell: (r) => <StatusBadge value={r.event_result} /> },
    { id: "caller_id", header: "Caller", sortable: true, sortValue: (r) => r.caller_id, cell: (r) => r.caller_id },
    { id: "scan_id", header: "Scan", sortable: true, sortValue: (r) => r.scan_id ?? "", cell: (r) => <span className="font-mono text-xs">{r.scan_id ?? "—"}</span> },
    { id: "job_id", header: "Job", sortable: true, sortValue: (r) => r.job_id ?? "", cell: (r) => <span className="font-mono text-xs">{r.job_id ?? "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        version={appVersion}
        description="NIST AU-3 structured audit events with event, scan, role, and result filters."
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </PageHeader>
      {/* PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): diagnostics / health /
          resource-metrics panel above the NIST AU-3 audit table. */}
      <DiagnosticsHealthPanel
        title="System diagnostics"
        description="Live resource metrics and service health for the SBOM MCP service."
        metricsUrl="/status"
        metricsIntervalMs={30_000}
        health={health}
        error={healthError}
        onRefresh={refreshHealth}
      />
      <div className="grid gap-3 md:grid-cols-[16rem_1fr_14rem]">
        <Select aria-label="Filter audit event type" value={eventType} onChange={(event) => setEventType(event.currentTarget.value)}>
          <option value="">Any event type</option>
          {AUDIT_EVENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Input aria-label="Filter audit scan id" placeholder="Scan ID" value={scanId} onChange={(event) => setScanId(event.currentTarget.value)} />
        <Select aria-label="Filter audit role" value={role} onChange={(event) => setRole(event.currentTarget.value)}>
          <option value="">Any caller or role</option>
          {roles.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </div>
      <StatusLine loading={loading} error={error} status={`${filtered.length} audit events visible`} />
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(r) => r.event_id}
        getRowTestId={(r) => `audit-row-${r.event_id}`}
        emptyMessage="No audit events match the current filters."
        pageSize={50}
        columnPickerEnabled
        tableId="sbom-mcp-audit"
      />
    </div>
  );
}
