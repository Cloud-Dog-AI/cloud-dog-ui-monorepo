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
import type { ServerLogRow } from "../lib/types";
import { useGitMcpState } from "../state/AppState";

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
  "requestId",
  "correlationId",
  "service",
  "actions",
];

export function AuditLogPage() {
  const { api, apiKey } = useGitMcpState();
  const [rows, setRows] = React.useState<ServerLogRow[]>([]);
  const [activeType, setActiveType] = React.useState<string>("audit");
  const [query, setQuery] = React.useState("");
  const [selectedRow, setSelectedRow] = React.useState<ServerLogRow | null>(null);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [tableReady, setTableReady] = React.useState(typeof window === "undefined");

  const load = React.useCallback(async () => {
    try {
      const items = await api.listServerLogs(apiKey, activeType, 200, query.trim());
      setRows(items);
      setError("");
      setStatus(`Loaded ${items.length} ${sourceLabel(activeType)} entries.`);
    } catch {
      setError("Failed to load runtime log events.");
      setStatus("");
    }
  }, [activeType, api, apiKey, query]);

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
  }, [activeType, query]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      setTableReady(true);
      return;
    }
    try {
      const storageKey = "dt.cols.git-mcp-audit-log";
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
      cell: (row) => <span className="font-mono text-xs">{displayText(row.actorIp || row.actor_ip)}</span>,
      sortable: true,
      sortValue: (row) => displayText(row.actorIp || row.actor_ip),
    },
    { id: "eventType", header: "Event Type", cell: (row) => row.eventType || row.event_type || "N/A", sortable: true, sortValue: (row) => row.eventType || row.event_type },
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
      cell: (row) => <span className="font-mono text-xs break-all">{row.traceId || row.trace_id || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.traceId || row.trace_id,
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
      cell: (row) => <span className="font-mono text-xs break-all">{row.requestId || row.request_id || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.requestId || row.request_id,
    },
    {
      id: "correlationId",
      header: "Correlation ID",
      cell: (row) => <span className="font-mono text-xs break-all">{row.correlationId || row.correlation_id || row.requestId || row.request_id || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.correlationId || row.correlation_id || row.requestId || row.request_id,
    },
    {
      id: "actorRoles",
      header: "Actor Roles",
      cell: (row) => row.actorRoles?.length ? row.actorRoles.join(", ") : row.actor_roles?.length ? row.actor_roles.join(", ") : "N/A",
      sortable: true,
      sortValue: (row) => row.actorRoles?.join(",") || row.actor_roles?.join(",") || "",
    },
    {
      id: "userAgent",
      header: "User Agent",
      cell: (row) => <span className="font-mono text-xs break-all">{row.actorUserAgent || row.actor_user_agent || "N/A"}</span>,
      sortable: true,
      sortValue: (row) => row.actorUserAgent || row.actor_user_agent,
    },
    {
      id: "targetName",
      header: "Target Name",
      cell: (row) => row.targetName || row.target_name || "N/A",
      sortable: true,
      sortValue: (row) => row.targetName || row.target_name,
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
      cell: (row) => row.source || row.type || sourceLabel(activeType),
      sortable: true,
      sortValue: (row) => row.source || row.type || "",
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
          Source-aware API, WebUI, MCP, A2A, and audit log review with AU-3 fields, search, and column picker.
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Runtime Log Viewer</h2>
            <p className="text-sm text-muted-foreground">
              Switch between Audit, API, WebUI, MCP, and A2A logs. Search and sort against current live entries.
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => downloadJson(`git-mcp-${activeType}-logs.json`, rows)}>
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
            {status ? <p role="status" className="text-foreground/80">{status}</p> : null}
          </div>

          {tableReady ? (
            <DataTable
              columns={columns}
              rows={rows}
              totalRows={rows.length}
              getRowId={(row) => row.id}
              emptyMessage="No log entries are available for the current source."
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              columnPickerEnabled
              tableId="git-mcp-audit-log"
            />
          ) : null}
        </CardContent>
      </Card>

      {selectedRow ? (
        <StructuredView title="Log Entry" value={selectedRow.raw ?? selectedRow} />
      ) : null}
    </div>
  );
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

function sourceLabel(value: string): string {
  return LOG_SOURCES.find((item) => item.id === value)?.label ?? value.toUpperCase();
}

function formatLocalTimestamp(value?: string): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function displayText(value?: string, fallback = "N/A"): string {
  const text = value?.trim() ?? "";
  return text && !/^unknown$/i.test(text) ? text : fallback;
}

function formatActor(row: ServerLogRow): string {
  return `${displayText(row.actorType || row.actor_type, "system")}:${displayText(row.actorId || row.actor_id, "anonymous")}`;
}

function formatTarget(row: ServerLogRow): string {
  return `${displayText(row.targetType || row.target_type, "resource")}:${displayText(row.targetId || row.target_id, "unassigned")}`;
}

function formatService(row: ServerLogRow): string {
  return `${displayText(row.service)} / ${displayText(row.serviceInstance || row.service_instance)}`;
}

function formatDetails(row: ServerLogRow): string {
  const entries = Object.entries(row.details || {})
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  return entries.length ? entries.join(" | ") : "N/A";
}
