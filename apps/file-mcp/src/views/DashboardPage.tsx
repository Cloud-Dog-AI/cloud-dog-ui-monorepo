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

// @cloud-dog/app-file-mcp — Dashboard page.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  MetricCard,
  QuickActionBar,
  RelativeTime,
  ResourceMetrics,
  Spinner,
  type DataColumn,
  type MetricItem,
} from "@cloud-dog/ui";
import { DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import type { AuditEntry, BackendStatusResponse, HealthResponse, StatusResponse } from "../lib/types";
import { useFileMcpState } from "../state/AppState";

type ActivityRow = Readonly<{
  id: string;
  timestamp: string;
  actorId: string;
  actorIp: string;
  action: string;
  target: string;
  outcome: string;
}>;

function statusUrlFromApiBase(apiBaseUrl: string): string {
  const cleaned = apiBaseUrl.replace(/\/+$/, "");
  if (!cleaned) return `${window.location.origin}/status`;
  if (cleaned.endsWith("/api")) {
    const base = cleaned.slice(0, -4) || window.location.origin;
    return `${base}/status`;
  }
  return `${cleaned}/status`;
}

function formatMetric(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return suffix ? `${value}${suffix}` : String(value);
}

function formatUptime(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "N/A";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { api, auditLogPath, apiBaseUrl } = useFileMcpState();

  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [backend, setBackend] = React.useState<BackendStatusResponse | null>(null);
  const [statusMetrics, setStatusMetrics] = React.useState<StatusResponse | null>(null);
  const [toolCount, setToolCount] = React.useState(0);
  const [activity, setActivity] = React.useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activityQuery, setActivityQuery] = React.useState("");
  const [activityPage, setActivityPage] = React.useState(1);
  const [activityPageSize, setActivityPageSize] = React.useState(10);

  const statusUrl = React.useMemo(() => statusUrlFromApiBase(apiBaseUrl), [apiBaseUrl]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [healthResult, backendResult, statusResult, tools, audit] = await Promise.all([
        api.getHealth(),
        api.backendStatus(),
        api.getStatus(),
        api.listTools(),
        api.readAuditLog(auditLogPath),
      ]);

      setHealth(healthResult);
      setBackend(backendResult);
      setStatusMetrics(statusResult);
      setToolCount(tools.length);
      setActivity(audit.slice(0, 50));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [api, auditLogPath]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const rows: ActivityRow[] = activity.map((entry, index) => ({
    id: `${entry.timestamp}-${entry.correlation_id ?? entry.target?.id ?? index}-${index}`,
    timestamp: entry.timestamp,
    actorId: entry.actor?.id ?? entry.actor_id ?? "-",
    actorIp: entry.actor?.ip ?? entry.client_ip ?? "-",
    action: entry.action ?? entry.event_type ?? "-",
    target:
      entry.target?.name ??
      entry.target?.id ??
      entry.tool ??
      entry.tool_name ??
      "-",
    outcome: entry.outcome ?? "-",
  }));

  const columns: DataColumn<ActivityRow>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      cell: (row) => <RelativeTime timestamp={row.timestamp} />,
      sortable: true,
      sortValue: (row) => new Date(row.timestamp).getTime(),
    },
    { id: "actorId", header: "Who", cell: (row) => row.actorId, sortable: true, sortValue: (row) => row.actorId },
    { id: "actorIp", header: "From", cell: (row) => row.actorIp, sortable: true, sortValue: (row) => row.actorIp },
    { id: "action", header: "Action", cell: (row) => row.action, sortable: true, sortValue: (row) => row.action },
    { id: "target", header: "Target", cell: (row) => row.target, sortable: true, sortValue: (row) => row.target },
    { id: "outcome", header: "Outcome", cell: (row) => row.outcome, sortable: true, sortValue: (row) => row.outcome },
  ];

  React.useEffect(() => {
    setActivityPage(1);
  }, [activityQuery]);

  const filteredActivityRows = React.useMemo(() => {
    const trimmed = activityQuery.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      `${row.timestamp} ${row.actorId} ${row.actorIp} ${row.action} ${row.target} ${row.outcome}`
        .toLowerCase()
        .includes(trimmed)
    );
  }, [activityQuery, rows]);

  const resourceMetrics: MetricItem[] = [
    { label: "Uptime", value: formatUptime(statusMetrics?.uptime_seconds) },
    { label: "Memory", value: formatMetric(statusMetrics?.memory_mb), unit: "MB" },
    { label: "Memory %", value: formatMetric(statusMetrics?.memory_percent), unit: "%" },
    { label: "CPU", value: formatMetric(statusMetrics?.cpu_percent), unit: "%" },
    { label: "Disk", value: formatMetric(statusMetrics?.disk_percent), unit: "%" },
    { label: "Connections", value: formatMetric(statusMetrics?.active_connections) },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={isLoading}>
          Refresh
        </Button>
      </header>

      <VersionInfo version={health?.version} buildDate={health?.build_date} commitHash={health?.commit} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Operational summary</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Service status</p>
            <p className="text-base font-medium capitalize">
              {health?.readiness ?? health?.status ?? "unknown"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active backend</p>
            <p className="text-base font-medium">{backend?.active_backend ?? "unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available tools</p>
            <p className="text-base font-medium">{toolCount || 0}</p>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Spinner className="h-5 w-5" />
          Loading dashboard...
        </div>
      ) : null}

      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="File count" value={statusMetrics?.service_metrics.file_count ?? "N/A"} />
            <MetricCard label="Storage used" value={statusMetrics?.service_metrics.storage_used_mb ?? "N/A"} unit="MB" />
            <MetricCard label="Profile count" value={statusMetrics?.service_metrics.profile_count ?? "N/A"} />
            <MetricCard label="Active connections" value={statusMetrics?.active_connections ?? "N/A"} />
          </>
        }
        quickActions={
          <QuickActionBar
            actions={[
              { label: "Browse files", onClick: () => navigate("/file-browser") },
              { label: "Search files", onClick: () => navigate("/search") },
              { label: "Manage profiles", onClick: () => navigate("/storage-profiles") },
              { label: "View audit log", onClick: () => navigate("/audit-log") },
              { label: "Manage identity", onClick: () => navigate("/admin/users") },
              { label: "Google Drive setup", onClick: () => navigate("/google-drive-settings") },
              { label: "MCP Console", onClick: () => navigate("/developer/mcp-console") },
              { label: "A2A console", onClick: () => navigate("/developer/a2a-console") },
            ]}
          />
        }
        recentActivity={
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Recent file activity</h2>
                <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
              </div>
              <Input
                className="max-w-md"
                value={activityQuery}
                onChange={(event) => setActivityQuery(event.target.value)}
                placeholder="Search activity"
                aria-label="Search activity"
              />
            </CardHeader>
            <CardContent>
              <DataTable
                tableId="file-mcp-dashboard-activity"
                columns={columns}
                rows={filteredActivityRows}
                totalRows={rows.length}
                getRowId={(row) => row.id}
                emptyMessage="No recent activity in the audit log."
            selectable={true}
                bulkActions={[
                  { label: "Export selected", action: "export" },
                ]}
                onBulkAction={(action, ids) => {
                  if (action === "export") {
                    const sel = filteredActivityRows.filter(r => ids.includes(r.id));
                    const blob = new Blob([JSON.stringify(sel, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "activity-export.json";
                    a.click();
                  }
                }}
                page={activityPage}
                onPageChange={setActivityPage}
                pageSize={activityPageSize}
                onPageSizeChange={setActivityPageSize}
                columnPickerEnabled={true}
              />
            </CardContent>
          </Card>
        }
      >
        <ResourceMetrics
          metrics={resourceMetrics}
          fetchUrl={statusUrl}
          intervalMs={30_000}
        />
      </DashboardLayout>
    </div>
  );
}
