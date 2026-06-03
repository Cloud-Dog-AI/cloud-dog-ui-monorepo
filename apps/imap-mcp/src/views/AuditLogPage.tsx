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

// @cloud-dog/app-imap-mcp — Audit and diagnostics page using shared observability patterns.

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  Input,
  ResourceMetrics,
  Select,
  StructuredView,
  type DataColumn,
  type MetricItem,
} from "@cloud-dog/ui";
import type { ServerLogRow, TraceEvent } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

const LOG_SOURCES = [
  { id: "audit", label: "Audit" },
  { id: "api", label: "API" },
  { id: "web", label: "WebUI" },
  { id: "mcp", label: "MCP" },
  { id: "a2a", label: "A2A" },
] as const;

const DEFAULT_VISIBLE_COLUMNS = [
  "who",
  "from",
  "eventType",
  "action",
  "target",
  "outcome",
  "severity",
  "timestamp",
  "traceId",
  "service",
  "actions",
];

const traceColumns: DataColumn<TraceEvent>[] = [
  {
    id: "action",
    header: "Action",
    cell: (traceEvent) => <span className="font-mono text-xs">{traceEvent.action}</span>,
    sortable: true,
    sortValue: (traceEvent) => traceEvent.action,
  },
  {
    id: "status",
    header: "Status",
    cell: (traceEvent) => traceEvent.status,
    sortable: true,
    sortValue: (traceEvent) => traceEvent.status,
  },
  {
    id: "requestId",
    header: "Request ID",
    cell: (traceEvent) => <span className="font-mono text-xs">{traceEvent.requestId || "-"}</span>,
    sortable: true,
    sortValue: (traceEvent) => traceEvent.requestId || "",
  },
  {
    id: "correlationId",
    header: "Correlation ID",
    cell: (traceEvent) => <span className="font-mono text-xs">{traceEvent.correlationId || "-"}</span>,
    sortable: true,
    sortValue: (traceEvent) => traceEvent.correlationId || "",
  },
];

function TraceLogTable(props: { traces: TraceEvent[] }) {
  return (
    <div className="w-full overflow-auto">
      <table aria-label="Trace log" className="w-full text-sm">
        <thead className="border-b">
          <tr className="border-b hover:bg-muted/40">
            {traceColumns.map((column) => (
              <th key={column.id} className="px-3 py-2 text-left font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.traces.length ? (
            props.traces.map((traceEvent, index) => (
              <tr
                key={`${traceEvent.timestamp}-${traceEvent.scope}-${traceEvent.action}-${traceEvent.requestId || traceEvent.correlationId || "trace"}-${index}`}
                aria-label={`${traceEvent.action} ${traceEvent.status} ${traceEvent.requestId || "-"}`}
                className="border-b hover:bg-muted/40"
              >
                {traceColumns.map((column) => (
                  <td key={column.id} className="px-3 py-2">
                    {column.cell(traceEvent)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="border-b hover:bg-muted/40">
              <td colSpan={traceColumns.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                No trace events recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function flattenMetrics(raw: Record<string, unknown>): MetricItem[] {
  return [
    { label: "Uptime", value: String(raw.uptime ?? "N/A"), unit: typeof raw.uptime === "number" ? "s" : undefined, tone: raw.uptime == null ? "neutral" : undefined },
    { label: "Memory", value: String(raw.memory_mb ?? "N/A"), unit: raw.memory_mb == null ? undefined : "MB", tone: raw.memory_mb == null ? "neutral" : undefined },
    { label: "CPU", value: String(raw.cpu_percent ?? "N/A"), unit: raw.cpu_percent == null ? undefined : "%", tone: raw.cpu_percent == null ? "neutral" : undefined },
    { label: "Connections", value: String(raw.active_connections ?? "N/A"), tone: raw.active_connections == null ? "neutral" : undefined },
  ];
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function summarise(status: string, suffix: string): string {
  return suffix ? `${status} ${suffix}` : status;
}

export function DiagnosticsAuditPage() {
  const { api, traces } = useImapMcpState();
  // XC-006: pre-populate the search filter from URL params so click-through
  // links like /diagnostics-audit?actor_id=<userId> land with the relevant
  // events already filtered.
  const [searchParams] = useSearchParams();
  const urlFilter = React.useMemo(() => {
    for (const key of ["actor_id", "target_id", "api_key_id", "job_id", "request_id", "trace_id"]) {
      const value = searchParams.get(key);
      if (value && value.trim()) return value.trim();
    }
    return "";
  }, [searchParams]);
  const [rows, setRows] = React.useState<ServerLogRow[]>([]);
  const [activeType, setActiveType] = React.useState<string>("audit");
  const [query, setQuery] = React.useState(urlFilter);
  React.useEffect(() => {
    if (urlFilter) setQuery(urlFilter);
  }, [urlFilter]);
  const deferredQuery = React.useDeferredValue(query);
  const [metrics, setMetrics] = React.useState<MetricItem[]>(flattenMetrics({}));
  const [selectedRow, setSelectedRow] = React.useState<ServerLogRow | null>(null);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [probeStatus, setProbeStatus] = React.useState("Ready.");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [tableReady, setTableReady] = React.useState(typeof window === "undefined");

  const runSearchProbe = React.useCallback(async () => {
    const result = await api.callTool<Record<string, unknown>>("mail_search", {
      profile_id: "operations",
      query: "ALL",
      mode: "imap",
      filters: { folder: "INBOX" },
    });
    setProbeStatus(
      summarise(
        `search probe status=${result.meta.status} request_id=${result.meta.requestId || "-"} correlation_id=${result.meta.correlationId || "-"}`,
        result.errorMessage || ""
      )
    );
  }, [api]);

  const runFailureProbe = React.useCallback(async () => {
    const result = await api.callTool<Record<string, unknown>>("mail_delete_messages", {
      profile_id: "operations",
      folder: "INBOX",
      uids: ["1"],
    });
    setProbeStatus(
      summarise(
        `failure probe status=${result.meta.status} request_id=${result.meta.requestId || "-"} correlation_id=${result.meta.correlationId || "-"}`,
        result.errorMessage || result.errorCode || ""
      )
    );
  }, [api]);

  const load = React.useCallback(async () => {
    const [logResult, statusResult] = await Promise.all([
      api.listServerLogs(activeType, 200, deferredQuery.trim()),
      api.getStatus(),
    ]);
    if (!logResult.ok || !logResult.data) {
      setError(logResult.errorMessage || "Failed to load server logs.");
      setStatus("");
    } else {
      setRows(logResult.data);
      setError("");
      setStatus(`Loaded ${logResult.data.length} ${sourceLabel(activeType)} entries.`);
    }
    if (statusResult.ok && statusResult.data) {
      setMetrics(flattenMetrics(statusResult.data));
    }
  }, [activeType, api, deferredQuery]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    setPage(1);
    setSelectedRow(null);
  }, [activeType, deferredQuery]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      setTableReady(true);
      return;
    }
    try {
      const storageKey = "dt.cols.imap-audit-log";
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(DEFAULT_VISIBLE_COLUMNS));
      }
    } catch {
      // Ignore storage failures; DataTable falls back to all columns.
    }
    setTableReady(true);
  }, []);

  const columns: DataColumn<ServerLogRow>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      cell: (row) => <span className="font-mono text-xs">{formatLocalTimestamp(row.timestamp)}</span>,
      sortable: true,
      sortValue: (row) => row.timestamp,
    },
    {
      id: "who",
      header: "Who",
      cell: (row) => <span className="font-mono text-xs">{formatActor(row)}</span>,
      sortable: true,
      sortValue: (row) => formatActor(row),
    },
    {
      id: "from",
      header: "From",
      cell: (row) => <span className="font-mono text-xs">{row.actorIp || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.actorIp,
    },
    { id: "eventType", header: "Event Type", cell: (row) => row.eventType || "N/A", sortable: true, sortValue: (row) => row.eventType },
    { id: "action", header: "Action", cell: (row) => row.action || "N/A", sortable: true, sortValue: (row) => row.action },
    {
      id: "target",
      header: "Target",
      cell: (row) => <span className="font-mono text-xs">{formatTarget(row)}</span>,
      sortable: true,
      sortValue: (row) => formatTarget(row),
    },
    { id: "outcome", header: "Outcome", cell: (row) => row.outcome || "N/A", sortable: true, sortValue: (row) => row.outcome },
    { id: "severity", header: "Severity", cell: (row) => row.severity || "N/A", sortable: true, sortValue: (row) => row.severity },
    {
      id: "traceId",
      header: "Trace ID",
      cell: (row) => <span className="font-mono text-xs break-all">{row.traceId || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.traceId,
    },
    {
      id: "service",
      header: "Service",
      cell: (row) => <span className="font-mono text-xs">{formatService(row)}</span>,
      sortable: true,
      sortValue: (row) => formatService(row),
    },
    {
      id: "requestId",
      header: "Request ID",
      cell: (row) => <span className="font-mono text-xs break-all">{row.requestId || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.requestId,
    },
    {
      id: "actorRoles",
      header: "Actor Roles",
      cell: (row) => row.actorRoles.length ? row.actorRoles.join(", ") : "N/A",
      sortable: true,
      sortValue: (row) => row.actorRoles.join(","),
    },
    {
      id: "userAgent",
      header: "User Agent",
      cell: (row) => <span className="font-mono text-xs break-all">{row.actorUserAgent || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.actorUserAgent,
    },
    {
      id: "targetName",
      header: "Target Name",
      cell: (row) => row.targetName || "N/A",
      sortable: true,
      sortValue: (row) => row.targetName,
    },
    {
      id: "details",
      header: "Details",
      cell: (row) => <span className="font-mono text-xs break-all">{formatDetails(row)}</span>,
      sortable: true,
      sortValue: (row) => formatDetails(row),
    },
    {
      id: "message",
      header: "Message",
      cell: (row) => <span className="font-mono text-xs break-all">{row.message || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.message,
    },
    {
      id: "source",
      header: "Source",
      cell: (row) => row.source || sourceLabel(activeType),
      sortable: true,
      sortValue: (row) => row.source,
    },
    {
      id: "actions",
      header: "Inspect",
      cell: (row) => (
        <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedRow(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Source-aware audit and runtime log review with AU-3 fields and column picker.
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Audit Entries</h2>
            <p className="text-sm text-muted-foreground">
              Switch between Audit, API, WebUI, MCP, and A2A logs. Search and sort against current live entries.
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => downloadJson(`imap-${activeType}-logs.json`, rows)}>
            Export JSON
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span>Log source</span>
              <Select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Log source"
                value={activeType}
                onChange={(event) => setActiveType(event.target.value)}
              >
                {LOG_SOURCES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
              <span>Search</span>
              <Input
                aria-label="Search logs"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by actor, action, target, trace ID, request ID, or message"
              />
            </label>

            <Button type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Current source: {sourceLabel(activeType)}</p>
            {status ? <p className="text-foreground/80">{status}</p> : null}
          </div>

          {tableReady ? (
            <div className="w-full overflow-x-auto">
              <DataTable
                columns={columns}
                rows={rows}
                getRowId={(row) => row.id}
                emptyMessage="No log entries are available for the current source."
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                columnPickerEnabled
                tableId="imap-audit-log"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Trace Log</h2>
        </CardHeader>
        <CardContent>
          <TraceLogTable traces={traces} />
        </CardContent>
      </Card>

      <EntityDialog
        open={selectedRow !== null}
        onOpenChange={(open) => { if (!open) setSelectedRow(null); }}
        title={selectedRow ? `Audit entry — ${selectedRow.action || selectedRow.eventType || selectedRow.id}` : "Audit entry"}
        body={
          selectedRow ? (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">When:</span> {formatLocalTimestamp(selectedRow.timestamp)}</div>
                <div><span className="text-muted-foreground">Who:</span> <span className="font-mono">{formatActor(selectedRow)}</span></div>
                <div><span className="text-muted-foreground">From:</span> <span className="font-mono">{selectedRow.actorIp || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Target:</span> <span className="font-mono">{formatTarget(selectedRow)}</span></div>
                <div><span className="text-muted-foreground">Outcome:</span> {selectedRow.outcome || "N/A"}</div>
                <div><span className="text-muted-foreground">Severity:</span> {selectedRow.severity || "N/A"}</div>
                <div><span className="text-muted-foreground">Trace ID:</span> <span className="font-mono break-all">{selectedRow.traceId || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Request ID:</span> <span className="font-mono break-all">{selectedRow.requestId || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Service:</span> <span className="font-mono">{formatService(selectedRow)}</span></div>
                <div><span className="text-muted-foreground">Roles:</span> {selectedRow.actorRoles.join(", ") || "N/A"}</div>
              </div>
              <StructuredView title="Raw entry" value={selectedRow.raw} />
            </div>
          ) : null
        }
      />
    </div>
  );
}

function sourceLabel(value: string): string {
  return LOG_SOURCES.find((item) => item.id === value)?.label ?? value.toUpperCase();
}

function formatLocalTimestamp(value?: string): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatActor(row: ServerLogRow): string {
  return `${row.actorType || "unknown"}:${row.actorId || "unknown"}`;
}

function formatTarget(row: ServerLogRow): string {
  return `${row.targetType || "unknown"}:${row.targetId || "unknown"}`;
}

function formatService(row: ServerLogRow): string {
  return `${row.service || "N/A"} / ${row.serviceInstance || "N/A"}`;
}

function formatDetails(row: ServerLogRow): string {
  const entries = Object.entries(row.details || {})
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  return entries.length ? entries.join(" | ") : "N/A";
}
