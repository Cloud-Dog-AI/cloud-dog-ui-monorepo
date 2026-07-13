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
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@cloud-dog/shell";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  MetricCard,
  Select,
  ResourceMetrics,
  Spinner,
  StructuredView,
  formatSeconds,
  useAuditLink,
  type DataColumn,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { ServerLogRow, UiStatusPayload } from "../lib/types";

const POLL_INTERVAL_MS = 30_000;
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

function emptyStatus(): UiStatusPayload {
  return {
    uptime_seconds: 0,
    memory_mb: 0,
    memory_percent: 0,
    cpu_percent: 0,
    disk_percent: 0,
    active_connections: 0,
    service_metrics: {
      workspace_count: 0,
      total_repo_size_mb: 0,
      profile_count: 0,
    },
    services: [],
    metrics: [
      { label: "Memory", value: "N/A" },
      { label: "CPU", value: "N/A" },
      { label: "Disk", value: "N/A" },
      { label: "Connections", value: "N/A" },
    ],
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { api, apiKey } = useGitMcpState();
  const { linkToCorrelation } = useAuditLink();
  const [status, setStatus] = React.useState<UiStatusPayload>(emptyStatus());
  const [workspaceCount, setWorkspaceCount] = React.useState(0);
  const [recentRows, setRecentRows] = React.useState<ServerLogRow[]>([]);
  const [activeSource, setActiveSource] = React.useState("audit");
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [selectedRow, setSelectedRow] = React.useState<ServerLogRow | null>(null);
  const [tableReady, setTableReady] = React.useState(typeof window === "undefined");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(8);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextStatus, nextRows, workspaces] = await Promise.all([
        api.getStatus(),
        api.listServerLogs(apiKey, activeSource, 100, deferredQuery.trim()),
        // GMC-D-05: owner-scoped live count (resets with backend; no stale 692).
        api.listWorkspaces(apiKey, "me").catch(() => []),
      ]);
      setStatus(nextStatus);
      setRecentRows(nextRows);
      setWorkspaceCount(workspaces.length);
      setError(null);
      setStatusMessage(`Loaded ${nextRows.length} ${sourceLabel(activeSource)} entries.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard state.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSource, api, apiKey, deferredQuery]);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
    setSelectedRow(null);
  }, [activeSource, deferredQuery]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      setTableReady(true);
      return;
    }
    try {
      const storageKey = "dt.cols.git-mcp-dashboard-logs";
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
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedRow(row)}>
            View
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigate(linkToCorrelation(row.correlationId || row.correlation_id || row.requestId || row.request_id || ""))}
          >
            Actions › View Audit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Operational health, git workspace capacity, and recent live audit activity.</p>
        </div>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Spinner className="h-5 w-5" />
          Loading dashboard...
        </div>
      ) : null}

      {/* GMC-D-03: Resource Metrics sits at the top, directly under the Dashboard heading. */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Resource Metrics</h2>
        </CardHeader>
        <CardContent>
          <ResourceMetrics metrics={status.metrics.length ? status.metrics : emptyStatus().metrics} />
        </CardContent>
      </Card>

      <DashboardLayout
        metricCards={[
          <MetricCard key="workspaces" label="Workspaces" value={workspaceCount} />,
          <MetricCard key="uptime" label="Uptime" value={formatSeconds(status.uptime_seconds)} />,
          <MetricCard key="profiles" label="Profiles" value={status.service_metrics.profile_count} />,
          <MetricCard key="connections" label="Connections" value={status.active_connections} />,
          <MetricCard key="repo-size" label="Repo Size" value={status.service_metrics.total_repo_size_mb.toFixed(1)} unit="MiB" />,
        ]}
        recentActivity={
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-sm">
                <span>Log source</span>
                <Select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Dashboard log source"
                  value={activeSource}
                  onChange={(event) => setActiveSource(event.target.value)}
                >
                  {LOG_SOURCES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
                <span>Search recent activity</span>
                <Input
                  aria-label="Search recent activity"
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
              <p>Current source: {sourceLabel(activeSource)}</p>
              {statusMessage ? <p role="status" className="text-foreground/80">{statusMessage}</p> : null}
            </div>
            {tableReady ? (
              <DataTable
                columns={columns}
                rows={recentRows}
                totalRows={recentRows.length}
                getRowId={(row) => row.id}
                emptyMessage="No recent activity recorded."
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                columnPickerEnabled
                tableId="git-mcp-dashboard-logs"
              />
            ) : null}
          </div>
        }
      ></DashboardLayout>

      {selectedRow ? (
        <StructuredView title="Log Entry" value={selectedRow.raw ?? selectedRow} />
      ) : null}
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
