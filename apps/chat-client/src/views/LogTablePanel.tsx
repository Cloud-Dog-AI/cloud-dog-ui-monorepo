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
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  Select,
  StructuredView,
  type DataColumn,
} from "@cloud-dog/ui";
import type { ChatApi } from "../lib/api";
import type { LogSurfaceId, MonitoringLogRow } from "../lib/types";

export const DEFAULT_LOG_VISIBLE_COLUMNS = [
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
];

function formatLocalTimestamp(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatActor(row: MonitoringLogRow): string {
  return `${row.actor.type || "unknown"}:${row.actor.id || "unknown"}`;
}

function formatTarget(row: MonitoringLogRow): string {
  return `${row.target.type || "unknown"}:${row.target.id || "unknown"}`;
}

function formatService(row: MonitoringLogRow): string {
  return `${row.service || "N/A"} / ${row.service_instance || "N/A"}`;
}

function detailsSummary(row: MonitoringLogRow): string {
  if (!row.details) return "N/A";
  const entries = Object.entries(row.details)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  return entries.length ? entries.join(" | ") : "N/A";
}

function searchText(row: MonitoringLogRow): string {
  return [
    row.surface_label,
    row.message,
    row.event_type,
    row.action,
    row.outcome,
    row.severity,
    row.trace_id,
    row.request_id,
    row.service,
    row.service_instance,
    row.environment,
    row.actor.type,
    row.actor.id,
    row.actor.ip,
    row.actor.roles.join(" "),
    row.actor.user_agent,
    row.target.type,
    row.target.id,
    row.target.name,
    row.source_path,
    row.timestamp,
    row.details ? JSON.stringify(row.details) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type LogTablePanelProps = Readonly<{
  api: ChatApi;
  tableId: string;
  title: string;
  description: string;
  initialSurface?: LogSurfaceId;
  limit?: number;
  embedded?: boolean;
  defaultVisibleColumns?: string[];
}>;

export function LogTablePanel(props: LogTablePanelProps) {
  const {
    api,
    tableId,
    title,
    description,
    initialSurface = "audit",
    limit = 100,
    embedded = false,
    defaultVisibleColumns = DEFAULT_LOG_VISIBLE_COLUMNS,
  } = props;
  const [surface, setSurface] = React.useState<LogSurfaceId>(initialSurface);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<Awaited<ReturnType<ChatApi["getLogs"]>> | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(limit <= 10 ? limit : 25);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [selectedEntry, setSelectedEntry] = React.useState<MonitoringLogRow | null>(null);
  const [tableReady, setTableReady] = React.useState(typeof window === "undefined");

  React.useEffect(() => {
    if (typeof window === "undefined") {
      setTableReady(true);
      return;
    }
    try {
      const storageKey = `dt.cols.${tableId}`;
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(defaultVisibleColumns));
      }
    } catch {
      // Ignore storage failures; DataTable falls back to all columns.
    }
    setTableReady(true);
  }, [defaultVisibleColumns, tableId]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.getLogs({ limit, surface });
      setPayload(next);
      setStatus(
        `Loaded ${next.count} ${next.surface_label || surface.toUpperCase()} entries from ${next.source_path || "configured source"}.`
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load logs.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [api, limit, surface]);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
    setSelectedEntry(null);
  }, [surface, deferredQuery]);

  const availableSurfaces = payload?.available_surfaces?.length
    ? payload.available_surfaces
    : [
        { id: "audit" as const, label: "Audit trail" },
        { id: "api" as const, label: "API server" },
        { id: "web" as const, label: "Web server" },
        { id: "mcp" as const, label: "External service" },
        { id: "a2a" as const, label: "A2A server" },
      ];

  const rows = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return (payload?.entries ?? []).filter((row) => {
      if (!needle) return true;
      return searchText(row).includes(needle);
    });
  }, [deferredQuery, payload?.entries]);

  const columns = React.useMemo<DataColumn<MonitoringLogRow>[]>(() => [
    {
      id: "who",
      header: "Who",
      sortable: true,
      sortValue: (row) => formatActor(row),
      cell: (row) => <span className="font-mono text-xs">{formatActor(row)}</span>,
    },
    {
      id: "from",
      header: "From",
      sortable: true,
      sortValue: (row) => row.actor.ip,
      cell: (row) => <span className="font-mono text-xs">{row.actor.ip || "N/A"}</span>,
    },
    {
      id: "eventType",
      header: "Event Type",
      sortable: true,
      sortValue: (row) => row.event_type,
      cell: (row) => row.event_type || "N/A",
    },
    {
      id: "action",
      header: "Action",
      sortable: true,
      sortValue: (row) => row.action,
      cell: (row) => row.action || "N/A",
    },
    {
      id: "target",
      header: "Target",
      sortable: true,
      sortValue: (row) => formatTarget(row),
      cell: (row) => <span className="font-mono text-xs">{formatTarget(row)}</span>,
    },
    {
      id: "outcome",
      header: "Outcome",
      sortable: true,
      sortValue: (row) => row.outcome,
      cell: (row) => row.outcome || "N/A",
    },
    {
      id: "severity",
      header: "Severity",
      sortable: true,
      sortValue: (row) => row.severity || row.level,
      cell: (row) => row.severity || row.level || "N/A",
    },
    {
      id: "timestamp",
      header: "Timestamp",
      sortable: true,
      sortValue: (row) => row.timestamp,
      cell: (row) => <span className="font-mono text-xs">{formatLocalTimestamp(row.timestamp)}</span>,
    },
    {
      id: "traceId",
      header: "Trace ID",
      sortable: true,
      sortValue: (row) => row.trace_id,
      cell: (row) => <span className="font-mono text-xs break-all">{row.trace_id || "N/A"}</span>,
    },
    {
      id: "requestId",
      header: "Request ID",
      sortable: true,
      sortValue: (row) => row.request_id,
      cell: (row) => <span className="font-mono text-xs break-all">{row.request_id || "N/A"}</span>,
    },
    {
      id: "service",
      header: "Service",
      sortable: true,
      sortValue: (row) => formatService(row),
      cell: (row) => <span className="font-mono text-xs">{formatService(row)}</span>,
    },
    {
      id: "actorRoles",
      header: "Actor Roles",
      sortable: true,
      sortValue: (row) => row.actor.roles.join(","),
      cell: (row) => row.actor.roles.length ? row.actor.roles.join(", ") : "N/A",
    },
    {
      id: "userAgent",
      header: "User Agent",
      sortable: true,
      sortValue: (row) => row.actor.user_agent,
      cell: (row) => <span className="font-mono text-xs break-all">{row.actor.user_agent || "N/A"}</span>,
    },
    {
      id: "targetName",
      header: "Target Name",
      sortable: true,
      sortValue: (row) => row.target.name,
      cell: (row) => row.target.name || "N/A",
    },
    {
      id: "details",
      header: "Details",
      sortable: true,
      sortValue: (row) => detailsSummary(row),
      cell: (row) => <span className="font-mono text-xs break-all">{detailsSummary(row)}</span>,
    },
    {
      id: "message",
      header: "Message",
      sortable: true,
      sortValue: (row) => row.message,
      cell: (row) => <span className="font-mono text-xs break-all">{row.message || "N/A"}</span>,
    },
    {
      id: "source",
      header: "Source",
      sortable: true,
      sortValue: (row) => row.surface_label,
      cell: (row) => row.surface_label || row.surface.toUpperCase(),
    },
    {
      id: "environment",
      header: "Environment",
      sortable: true,
      sortValue: (row) => row.environment,
      cell: (row) => row.environment || "N/A",
    },
    {
      id: "inspect",
      header: "Inspect",
      cell: (row) => (
        <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedEntry(row)}>
          View
        </Button>
      ),
    },
  ], []);

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Log source</span>
          <Select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Log source"
            value={surface}
            onChange={(event) => setSurface(event.target.value as LogSurfaceId)}
          >
            {availableSurfaces.map((item) => (
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

        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Current source: {payload?.surface_label || availableSurfaces.find((item) => item.id === surface)?.label || surface.toUpperCase()}</p>
        <p>Path: {payload?.source_path || "Configured at runtime"}</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading live log entries...</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {tableReady ? (
        <DataTable
          tableId={tableId}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          totalRows={rows.length}
          emptyMessage={error ? "Log feed unavailable." : "No log entries match the current filter."}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          columnPickerEnabled={true}
        />
      ) : null}

      {selectedEntry ? (
        <StructuredView title="Log entry detail" value={selectedEntry.raw || selectedEntry} />
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
