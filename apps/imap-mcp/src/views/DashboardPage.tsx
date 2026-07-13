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

// @cloud-dog/app-imap-mcp — Shared dashboard layout for IMAP MCP operations.

import * as React from "react";
import { Link } from "react-router-dom";
import { DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  MetricCard,
  ResourceMetrics,
  Spinner,
  formatSeconds,
  formatBytes,
  type DataColumn,
  type HealthStatus,
  type MetricItem,
} from "@cloud-dog/ui";
import type { AuditEventRow } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type ServiceWidget = Readonly<{
  name: string;
  url: string;
  status: HealthStatus;
  detail: string;
}>;

function normaliseHealthStatus(value: string): HealthStatus {
  const status = value.trim().toLowerCase();
  if (status === "ok" || status === "healthy" || status === "success") return "ok";
  if (status === "warning" || status === "degraded") return "warning";
  if (status === "error" || status === "failed" || status === "down") return "error";
  return "unknown";
}

// IMAP-302 / CX-170: moment-format uptime via shared helper.
function formatUptime(value: unknown): string {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  return formatSeconds(seconds);
}

function defaultMetrics(): MetricItem[] {
  return [
    { label: "Uptime", value: "N/A", tone: "neutral" },
    { label: "Memory", value: "N/A", tone: "neutral" },
    { label: "CPU", value: "N/A", tone: "neutral" },
    { label: "Disk", value: "N/A", tone: "neutral" },
    { label: "Connections", value: "N/A", tone: "neutral" },
  ];
}

export function DashboardPage() {
  const { api } = useImapMcpState();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [version, setVersion] = React.useState<Record<string, unknown>>({});
  const [recentAuditRows, setRecentAuditRows] = React.useState<AuditEventRow[]>([]);
  const [auditQuery, setAuditQuery] = React.useState("");
  const deferredAuditQuery = React.useDeferredValue(auditQuery);
  const [auditPage, setAuditPage] = React.useState(1);
  const [auditPageSize, setAuditPageSize] = React.useState(8);
  const [auditTableReady, setAuditTableReady] = React.useState(typeof window === "undefined");
  const [serviceWidgets, setServiceWidgets] = React.useState<ServiceWidget[]>([
    { name: "API", url: "/health", status: "unknown", detail: "Waiting for probe" },
    { name: "MCP", url: "/mcp/health", status: "unknown", detail: "Waiting for probe" },
    { name: "A2A", url: "/a2a/health", status: "unknown", detail: "Waiting for probe" },
  ]);
  const [metrics, setMetrics] = React.useState<MetricItem[]>(defaultMetrics());

  // IMAP-020 / XC-012: do not flip `isLoading=true` on every poll — it
  // would replace the entire page with a spinner each interval. The
  // initial mount sets isLoading=true at useState; subsequent polls just
  // swap state in place.
  const initialLoadRef = React.useRef(true);
  const load = React.useCallback(async () => {
    setError("");

    const [health, versionResult, statusResult, auditResult] = await Promise.all([
      api.getHealth(),
      api.getVersion(),
      api.getStatus(),
      api.listAuditEvents(100, deferredAuditQuery.trim()),
    ]);

    if (!health.ok) {
      setError(`Health request failed (${health.meta.status}) ${health.errorMessage}`);
    }

    setRecentAuditRows(auditResult.ok && auditResult.data ? auditResult.data : []);
    setVersion(versionResult.ok && versionResult.data ? versionResult.data : {});
    setStatus(
      auditResult.ok
        ? `Loaded ${auditResult.data?.length ?? 0} recent audit events.`
        : ""
    );

    if (statusResult.ok && statusResult.data) {
      const data = statusResult.data as Record<string, unknown>;
      // IMAP-303: disk metric — prefer cache_bytes_used (new backend field), then
      // storage_bytes, then percentage; format with formatBytes.
      const cacheBytes = data.cache_bytes_used ?? data.storage_bytes_used ?? data.storage_bytes;
      const diskPercent = data.disk_percent ?? data.disk_used_percent ?? data.disk_usage_percent;
      const diskValue = cacheBytes != null
        ? formatBytes(Number(cacheBytes))
        : diskPercent != null
          ? `${diskPercent}%`
          : "—";
      // IMAP-302: uptime moment-formatted.
      const uptimeStr = formatUptime(statusResult.data.uptime);
      setMetrics([
        { label: "Uptime", value: uptimeStr },
        { label: "Memory", value: String(statusResult.data.memory_mb), unit: "MB" },
        { label: "CPU", value: String(statusResult.data.cpu_percent), unit: "%" },
        { label: "Disk (cache)", value: diskValue, tone: diskValue === "—" ? "neutral" : undefined },
        { label: "Connections", value: String(statusResult.data.active_connections) },
      ]);
    } else {
      setMetrics(defaultMetrics());
    }

    const checks = (health.data?.components ?? {}) as Record<string, unknown>;
    // Service tiles match every other Cloud-Dog service: API + MCP + A2A.
    // IMAP/Jobs surface as Health-check sub-status, not as top-level tiles.
    setServiceWidgets([
      {
        name: "API",
        url: "/health",
        status: normaliseHealthStatus(String(health.data?.status ?? "unknown")),
        detail: `Service ${String(health.data?.service ?? "imap-mcp-server")}`,
      },
      {
        name: "MCP",
        url: "/mcp/health",
        status: normaliseHealthStatus(String((checks.mcp as Record<string, unknown>)?.status ?? health.data?.status ?? "unknown")),
        detail: "MCP transport",
      },
      {
        name: "A2A",
        url: "/.well-known/agent.json",
        status: normaliseHealthStatus(String((checks.a2a as Record<string, unknown>)?.status ?? health.data?.status ?? "unknown")),
        detail: "A2A agent card + tasks",
      },
    ]);

    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      setIsLoading(false);
    }
  }, [api, deferredAuditQuery]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Session keep-alive: re-fetch /auth/me every 5 min to refresh the cookie TTL.
  React.useEffect(() => {
    const ping = () => {
      void fetch("/auth/me", { credentials: "include" }).catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    setAuditPage(1);
  }, [deferredAuditQuery]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      setAuditTableReady(true);
      return;
    }
    try {
      const storageKey = "dt.cols.imap-dashboard-audit";
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(DEFAULT_AUDIT_VISIBLE_COLUMNS));
      }
    } catch {
      // Ignore storage failures; DataTable falls back to all columns.
    }
    setAuditTableReady(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Spinner className="h-5 w-5" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <VersionInfo version={String(version.version ?? version.app_version ?? "")} />
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Service health, resource metrics, and recent activity for the IMAP MCP service.
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {/* W28E-1837 / PS-WEBUI-STYLE-COMPONENTS section 7 (STD-F02): canonical
          DashboardLayout — metric row + recent-activity table; the live
          ResourceMetrics detail panel (IMAP-301/305) is kept in the service-
          extension slot. CX-180: API/MCP/A2A status stays in the shell
          top-right cluster (TopBarActions), never duplicated in the body. */}
      <DashboardLayout
        metricCards={metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={String(metric.value)}
            unit={metric.unit}
          />
        ))}
        recentActivity={
          /* IMAP-307: body status widgets removed (shell top-right only).
             IMAP-308: Recent Activity wrapped in max-h with sticky header.
             IMAP-309: per-row audit click-through link + bulk-export. */
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Recent activity</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
                  <span>Search recent audit events</span>
                  <Input
                    aria-label="Search recent audit events"
                    value={auditQuery}
                    onChange={(event) => setAuditQuery(event.target.value)}
                    placeholder="Filter by actor, action, target, trace ID, request ID, or service"
                  />
                </label>
                <Button type="button" variant="secondary" onClick={() => void load()}>
                  Refresh
                </Button>
              </div>
              {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
              {auditTableReady ? (
                <div className="w-full overflow-x-auto max-h-[28rem]">
                  <DataTable
                    columns={auditColumnsWithLink}
                    rows={recentAuditRows}
                    getRowId={auditRowId}
                    emptyMessage="No recent activity recorded."
                    page={auditPage}
                    onPageChange={setAuditPage}
                    pageSize={auditPageSize}
                    onPageSizeChange={setAuditPageSize}
                    columnPickerEnabled
                    tableId="imap-dashboard-audit"
                    selectable
                    bulkActions={[{ label: "Export selected", action: "export" }]}
                    onBulkAction={(action, ids) => {
                      if (action !== "export") return;
                      const selected = recentAuditRows.filter((r) => ids.includes(auditRowId(r)));
                      const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `audit-export-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        }
      >
        {/* IMAP-305 / IMAP-301: live Resource Metrics detail panel (service-extension slot). */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Resource Metrics</h2>
          </CardHeader>
          <CardContent>
            <ResourceMetrics fetchUrl="/status" metrics={metrics} intervalMs={30000} />
          </CardContent>
        </Card>
      </DashboardLayout>
    </div>
  );
}

// IMAP-309: extend auditColumns with a per-row click-through link to the full audit page.
const auditLinkColumn: DataColumn<AuditEventRow> = {
  id: "open",
  header: "Open",
  cell: (row) => (
    <Link
      to={`/diagnostics-audit?request_id=${encodeURIComponent(row.requestId || "")}`}
      className="text-xs text-primary underline-offset-4 hover:underline"
      title="Open in Audit & Log"
    >
      open ↗
    </Link>
  ),
};

const auditColumns: DataColumn<AuditEventRow>[] = [
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
    cell: (row) => <span className="font-mono text-xs">{formatAuditActor(row)}</span>,
    sortable: true,
    sortValue: (row) => formatAuditActor(row),
  },
  {
    id: "from",
    header: "From",
    cell: (row) => <span className="font-mono text-xs">{row.actorIp || "N/A"}</span>,
    sortable: true,
    sortValue: (row) => row.actorIp,
  },
  { id: "eventType", header: "Event Type", cell: (row) => row.eventType || "N/A", sortable: true, sortValue: (row) => row.eventType },
  { id: "action", header: "Action", cell: (row) => row.action || row.operation || "N/A", sortable: true, sortValue: (row) => row.action || row.operation },
  {
    id: "target",
    header: "Target",
    cell: (row) => <span className="font-mono text-xs">{formatAuditTarget(row)}</span>,
    sortable: true,
    sortValue: (row) => formatAuditTarget(row),
  },
  { id: "outcome", header: "Outcome", cell: (row) => row.outcome || row.status || "N/A", sortable: true, sortValue: (row) => row.outcome || row.status },
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
    cell: (row) => <span className="font-mono text-xs">{formatAuditService(row)}</span>,
    sortable: true,
    sortValue: (row) => formatAuditService(row),
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
    cell: (row) => <span className="font-mono text-xs break-all">{formatAuditDetails(row)}</span>,
    sortable: true,
    sortValue: (row) => formatAuditDetails(row),
  },
];

// IMAP-309: extended columns with the per-row Open → audit link.
const auditColumnsWithLink: DataColumn<AuditEventRow>[] = [auditLinkColumn, ...auditColumns];

const DEFAULT_AUDIT_VISIBLE_COLUMNS = [
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

function auditRowId(row: AuditEventRow): string {
  return [
    row.timestamp,
    row.traceId,
    row.requestId,
    row.eventType,
    row.action,
    row.targetId,
  ].join("|");
}

function formatLocalTimestamp(value?: string): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatAuditActor(row: AuditEventRow): string {
  return [row.actorType || "unknown", row.actorId || "unknown"].join(":");
}

function formatAuditTarget(row: AuditEventRow): string {
  return [row.targetType || "unknown", row.targetId || "unknown"].join(":");
}

function formatAuditService(row: AuditEventRow): string {
  return `${row.service || "N/A"} / ${row.serviceInstance || "N/A"}`;
}

function formatAuditDetails(row: AuditEventRow): string {
  const entries = Object.entries(row.details || {})
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  return entries.length ? entries.join(" | ") : "N/A";
}
