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
import { Button, Card, CardContent, CardHeader, MetricCard, Spinner } from "@cloud-dog/ui";
import { useConfig } from "../lib/runtime-config";
import { useAppState } from "../state/AppState";
import type { ResourceStatusRecord } from "../lib/types";
import { DEFAULT_LOG_VISIBLE_COLUMNS, LogTablePanel } from "./LogTablePanel";

type RuntimeConfig = {
  APP_VERSION?: string;
};

function formatPercent(value: number | null): string {
  return value == null ? "N/A" : value.toFixed(1);
}

function uptimeLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function DashboardPage() {
  const cfg = useConfig<RuntimeConfig>();
  const navigate = useNavigate();
  const { api } = useAppState();
  const [isLoading, setIsLoading] = React.useState(true);
  const [status, setStatus] = React.useState<ResourceStatusRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // W28E-1837 / CX-180: do not flip isLoading=true on every poll — only the
  // initial mount sets it; subsequent interval polls swap state in place.
  const initialLoadRef = React.useRef(true);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const data = await api.getStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setIsLoading(false);
      }
    }
  }, [api]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Spinner className="h-5 w-5" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-auto">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <VersionInfo version={cfg.APP_VERSION} />
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {/* W28E-1837 / CX-180: API/MCP/A2A status stays in the shell-level
          ServiceStatusBar (App.tsx top-right cluster), never duplicated in the
          body. healthWidgets prop removed; DashboardLayout body-only. */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard
              label="Active sessions"
              value={status?.active_chat_sessions ?? 0}
              onClick={() => navigate("/sessions")}
              ariaLabel="Active sessions — open the sessions list with per-session expiry"
            />
            <MetricCard
              label="External services"
              value={status?.connected_mcp_endpoints ?? 0}
              onClick={() => navigate("/mcp-servers")}
              ariaLabel="External services — open the connected external services page"
            />
            <MetricCard label="Messages" value={status?.message_count ?? 0} />
            <MetricCard label="Model" value={status?.llm_model || "N/A"} />
          </>
        }
        recentActivity={
          <div className="space-y-6">
            <LogTablePanel
              api={api}
              tableId="chat-dashboard-audit-logs"
              title="Recent audit and runtime activity"
              description="Current audit events with source switching across API, Web, MCP, and A2A logs."
              initialSurface="audit"
              limit={12}
              embedded={true}
              defaultVisibleColumns={DEFAULT_LOG_VISIBLE_COLUMNS}
            />

            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardHeader><h3 className="text-sm font-semibold">Uptime</h3></CardHeader><CardContent>{uptimeLabel(status?.uptime_seconds ?? 0)}</CardContent></Card>
              <Card><CardHeader><h3 className="text-sm font-semibold">Memory</h3></CardHeader><CardContent>{status?.memory_mb?.toFixed(1) ?? "N/A"} MB</CardContent></Card>
              <Card><CardHeader><h3 className="text-sm font-semibold">CPU</h3></CardHeader><CardContent>{formatPercent(status?.cpu_percent ?? null)}%</CardContent></Card>
              <Card><CardHeader><h3 className="text-sm font-semibold">Disk</h3></CardHeader><CardContent>{formatPercent(status?.disk_percent ?? null)}%</CardContent></Card>
            </div>
          </div>
        }
      >
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Service context</h2>
              <p className="text-sm text-muted-foreground">Runtime environment and active connection snapshot.</p>
            </div>
            <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label="Environment" value={status?.environment || "N/A"} />
            <MetricCard label="Server ID" value={status?.server_id || "N/A"} />
            <MetricCard label="Active connections" value={status?.active_connections ?? 0} />
          </div>
        </div>
      </DashboardLayout>

      <CopyrightFooter />
    </div>
  );
}
