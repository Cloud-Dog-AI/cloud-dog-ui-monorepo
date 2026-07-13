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
import { Button, DataTable, Input, MetricCard, QuickActionBar, RelativeTime, Spinner, type DataColumn } from "@cloud-dog/ui";
import { DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { AuditEvent, IndexStatusItem } from "../lib/types";

/** DASH-8: Help footer removed — was a placeholder `?` icon with no useful content. */

type ActivityRow = Readonly<{
  timestamp: string;
  eventType: string;
  outcome: string;
  actor: string;
  actorIp: string;
  severity: string;
  traceId: string;
}>;

export function DashboardPage() {
  const navigate = useNavigate();
  const { api, currentProfile, profiles, refreshProfiles, appVersion } = useDbMcpState();
  const [jobs, setJobs] = React.useState<Record<string, unknown> | null>(null);
  const [indexStatus, setIndexStatus] = React.useState<IndexStatusItem | null>(null);
  const [activity, setActivity] = React.useState<AuditEvent[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [, jobsResult, auditResult] = await Promise.all([
        api.ping(),
        api.jobsHealth(),
        api.listAuditEvents(8),
      ]);
      setJobs(jobsResult as Record<string, unknown>);
      setActivity(auditResult);
      if (currentProfile) {
        const status = await api.indexStatus(currentProfile.profile_id);
        setIndexStatus(status[0] ?? null);
      } else {
        setIndexStatus(null);
      }
      await refreshProfiles();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [api, currentProfile, refreshProfiles]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const rows: ActivityRow[] = activity.map((entry) => ({
    timestamp: entry.timestamp,
    eventType: entry.action ?? entry.event_type,
    outcome: entry.outcome ?? "-",
    actor: entry.actor?.id ?? "-",
    actorIp: entry.actor?.ip ?? "-",
    severity: entry.severity ?? "-",
    traceId: (entry.trace_id ?? entry.correlation_id ?? "").substring(0, 8) || "-",
  }));

  const columns: DataColumn<ActivityRow>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      cell: (item) => <RelativeTime timestamp={item.timestamp} />,
      sortable: true,
      sortValue: (item) => item.timestamp,
    },
    { id: "eventType", header: "Event", cell: (item) => item.eventType, sortable: true, sortValue: (item) => item.eventType },
    { id: "outcome", header: "Outcome", cell: (item) => item.outcome, sortable: true, sortValue: (item) => item.outcome },
    { id: "actor", header: "Actor", cell: (item) => item.actor, sortable: true, sortValue: (item) => item.actor },
    { id: "actorIp", header: "IP", cell: (item) => item.actorIp, sortable: true, sortValue: (item) => item.actorIp },
    { id: "severity", header: "Severity", cell: (item) => item.severity, sortable: true, sortValue: (item) => item.severity },
    { id: "traceId", header: "Trace", cell: (item) => <span className="font-mono text-xs">{item.traceId}</span>, sortable: false },
  ];

  // DM-D-08: search box atop the recent-activity list — filters the activity rows
  // client-side across every displayed AU-3 field (event/outcome/actor/IP/trace).
  const [activitySearch, setActivitySearch] = React.useState("");
  const filteredRows = React.useMemo(() => {
    const needle = activitySearch.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.timestamp, row.eventType, row.outcome, row.actor, row.actorIp, row.severity, row.traceId]
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, activitySearch]);

  const defaultNamespace = currentProfile?.namespaces[0] ?? "";
  const defaultEntity = currentProfile?.entities[0] ?? "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <VersionInfo version={appVersion} />
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner className="h-5 w-5" /> Loading dashboard...
        </div>
      ) : null}

      {/* CX-180: API/MCP/A2A status renders only once in the shell's top-right ServiceStatusBar/TopBar.
          The former body-level healthWidgets cluster (HealthWidget API/MCP/A2A) was a duplicate and is removed. */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="Profiles" value={profiles.length} />
            <MetricCard label="Namespaces" value={indexStatus?.namespace_count ?? 0} />
            <MetricCard label="Entities" value={indexStatus?.entity_count ?? 0} />
            <MetricCard label="Queue Health" value={(jobs?.ok as boolean | undefined) ? "OK" : "CHECK"} />
            <MetricCard label="Database Type" value={currentProfile?.source_type ?? "No profile selected"} />
          </>
        }
        quickActions={
          <div className="space-y-3">
            <ProfileSelect />
            <QuickActionBar
              actions={[
                { label: "Search", onClick: () => navigate("/search") },
                { label: "Catalogue", onClick: () => navigate("/catalogue") },
                { label: "Settings", onClick: () => navigate("/system/settings") },
              ]}
            />
          </div>
        }
        recentActivity={
          <div className="space-y-3">
            <Input
              type="search"
              aria-label="Search recent activity"
              placeholder="Search recent activity..."
              value={activitySearch}
              onChange={(event) => setActivitySearch(event.target.value)}
              data-testid="dashboard-activity-search"
            />
            <DataTable
              columns={columns}
              rows={filteredRows}
              emptyMessage={activitySearch ? "No activity matches the search." : "No audit events recorded yet."}
              getRowId={(row) => `${row.timestamp}|${row.eventType}|${row.actor}`}
              selectable
              columnPickerEnabled
              tableId="db-mcp-dashboard-activity"
            />
          </div>
        }
      />
    </div>
  );
}
