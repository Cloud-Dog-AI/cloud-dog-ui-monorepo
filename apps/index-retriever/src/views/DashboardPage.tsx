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
import { CopyrightFooter, DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import { useConfig } from "@cloud-dog/config";
import { Button, DataTable, HealthWidget, MetricCard, QuickActionBar, RelativeTime, type DataColumn } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { AuditLogEntry, HealthResponse, StatusResponse } from "../lib/types";

function healthStatus(value: string | undefined): "ok" | "warning" | "error" | "unknown" {
  const status = (value ?? "").toLowerCase();
  if (status === "ok") return "ok";
  if (status === "warning") return "warning";
  if (status === "error") return "error";
  return "unknown";
}

type RuntimeConfig = {
  APP_VERSION?: string;
};

type ActivityRow = Readonly<{
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}>;

function formatDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "N/A";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(seconds)}s`;
}

function activityFromAudit(entry: AuditLogEntry, index: number): ActivityRow {
  return {
    id: `${entry.timestamp ?? "audit"}-${entry.correlation_id ?? index}`,
    action: entry.action ?? entry.event_type ?? entry.message ?? "api.audit",
    detail: `${entry.outcome ?? entry.severity ?? "unknown"}${entry.target?.id ? `: ${entry.target.id}` : ""}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
}

export function DashboardPage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();
  const navigate = useNavigate();
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [status, setStatus] = React.useState<StatusResponse | null>(null);
  const [auditActivity, setAuditActivity] = React.useState<ActivityRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [healthResult, statusResult, auditResult] = await Promise.all([
        app.api.getHealth(),
        app.api.getStatus(),
        app.api.getAuditLog({ limit: 10, log_source: "api" }).catch(() => ({ entries: [] })),
      ]);
      setHealth(healthResult);
      setStatus(statusResult);
      setAuditActivity((auditResult.entries ?? []).map(activityFromAudit));
    } catch (loadError) {
      const message = app.captureFailure(loadError);
      setError(message);
      app.recordActivity("dashboard.refresh", "error", message);
    }
  }, [app]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const activityRows = React.useMemo<ActivityRow[]>(
    () => {
      if (auditActivity.length > 0) return auditActivity;
      return app.activity
        .filter((event) => event.action !== "dashboard.refresh")
        .slice(0, 10)
        .map((event) => ({
          id: `${event.timestamp}-${event.action}`,
          action: event.action,
          detail: event.detail ?? event.outcome,
          timestamp: event.timestamp,
        }));
    },
    [app.activity, auditActivity]
  );

  const activityColumns = React.useMemo<DataColumn<ActivityRow>[]>(
    () => [
      { id: "action", header: "Action", cell: (row) => row.action, sortable: true, sortValue: (row) => row.action },
      { id: "detail", header: "Outcome", cell: (row) => row.detail, sortable: true, sortValue: (row) => row.detail },
      {
        id: "when",
        header: "When",
        cell: (row) => <RelativeTime timestamp={row.timestamp} />,
        sortable: true,
        sortValue: (row) => row.timestamp,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <VersionInfo version={cfg.APP_VERSION} />
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DashboardLayout
        healthWidgets={
          <>
            <HealthWidget name="API" status={healthStatus(health?.status)} detail={status?.host ?? "runtime"} url="/health" />
            <HealthWidget
              name="VDB"
              status={healthStatus(String((health?.checks?.vdb as { status?: string } | undefined)?.status))}
              detail={String((health?.checks?.vdb as { provider?: string } | undefined)?.provider ?? "backend")}
            />
            <HealthWidget
              name="Embedding"
              status={healthStatus(String((health?.checks?.embedding as { status?: string } | undefined)?.status))}
              detail={String((health?.checks?.embedding as { model?: string } | undefined)?.model ?? "embedding")}
            />
          </>
        }
        metricCards={
          <>
            <MetricCard label="Collections" value={status?.collection_count ?? "N/A"} />
            <MetricCard label="Documents" value={status?.document_count ?? "N/A"} />
            <MetricCard label="Indexes" value={status?.index_count ?? "N/A"} />
            <MetricCard label="Connections" value={status?.active_connections ?? "N/A"} />
          </>
        }
        quickActions={
          <QuickActionBar
            actions={[
              { label: "New Profile", onClick: () => navigate("/profiles") },
              { label: "New Collection", onClick: () => navigate("/collections") },
              { label: "Search", onClick: () => navigate("/ingest-search") },
              { label: "Ingest Document", onClick: () => navigate("/ingest-search"), variant: "default" },
            ]}
          />
        }
        recentActivity={
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                Refresh
              </Button>
            </div>
            {activityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API audit activity yet.</p>
            ) : (
              <DataTable
                tableId="dashboard-activity"
                rows={activityRows}
                columns={activityColumns}
                getRowId={(row) => row.id}
                emptyMessage="No API audit activity yet."
                page={1}
                pageSize={10}
              />
            )}
          </div>
        }
      >
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Uptime" value={formatDuration(status?.uptime_seconds)} />
          <MetricCard label="Memory" value={status?.memory_mb ?? "N/A"} unit="MB" />
          <MetricCard label="CPU" value={status?.cpu_percent ?? "N/A"} unit="%" />
          <MetricCard label="Disk" value={status?.disk_percent ?? "N/A"} unit="%" />
        </section>
      </DashboardLayout>

      <CopyrightFooter />
    </div>
  );
}
