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
import { Card, CardContent, CardHeader, HealthWidget, ResourceMetrics } from "@cloud-dog/ui";
import type { MetricItem } from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import type { MonitoringSummary } from "../lib/types";
import { DEFAULT_LOG_VISIBLE_COLUMNS, LogTablePanel } from "./LogTablePanel";

export function MonitoringPage() {
  const { api, mcpHealth, refreshMcpServers } = useAppState();
  const [summary, setSummary] = React.useState<MonitoringSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [nextSummary] = await Promise.all([api.getMonitoringSummary(), refreshMcpServers()]);
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load monitoring data");
    }
  }, [api, refreshMcpServers]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const resources = summary?.resources;
  const metrics: MetricItem[] = [
    { label: "Uptime", value: resources ? `${Math.floor(resources.uptime_seconds / 60)}m` : "N/A", tone: resources ? "ok" : "warning" },
    { label: "Memory", value: resources?.memory_mb?.toFixed(1) ?? "N/A", unit: "MB", tone: resources?.memory_mb != null ? "ok" : "warning" },
    { label: "CPU", value: resources?.cpu_percent?.toFixed(1) ?? "N/A", unit: "%", tone: resources?.cpu_percent != null ? "ok" : "warning" },
    { label: "Disk", value: resources?.disk_percent?.toFixed(1) ?? "N/A", unit: "%", tone: resources?.disk_percent != null ? "ok" : "warning" },
    { label: "Active sessions", value: String(summary?.metrics.active_sessions ?? 0), tone: "ok" },
    { label: "Messages / hour", value: String(summary?.metrics.messages_last_hour ?? 0), tone: "ok" },
    { label: "Tool calls / hour", value: String(summary?.metrics.tool_calls_last_hour ?? 0), tone: "ok" },
    { label: "Avg response", value: String(Math.round(summary?.metrics.average_response_ms ?? 0)), unit: "ms", tone: "warning" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Audit / Logs</h1>
        <p className="text-sm text-muted-foreground">
          Source-aware audit and runtime log review with AU-3 fields and shared DataTable controls.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Runtime health</h2>
          <p className="text-sm text-muted-foreground">Resource metrics and connected endpoint health for the current runtime.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResourceMetrics metrics={metrics} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {mcpHealth.map((item) => (
              <HealthWidget
                key={item.index}
                name={item.name}
                status={item.ok ? "ok" : item.ok === false ? "error" : "unknown"}
                detail={
                  item.ok === false
                    ? item.error || "Unreachable"
                    : typeof item.latency_ms === "number"
                      ? `${Math.round(item.latency_ms)}ms`
                      : "Pending health probe"
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <LogTablePanel
        api={api}
        tableId="chat-monitoring-logs"
        title="Log explorer"
        description="Switch between Audit, API, Web, MCP, and A2A surfaces with sortable AU-3 fields and column picker."
        initialSurface="audit"
        limit={200}
        defaultVisibleColumns={DEFAULT_LOG_VISIBLE_COLUMNS}
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
