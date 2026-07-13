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
import {
  Button,
  DataTable,
  MetricCard,
  QuickActionBar,
  RelativeTime,
  StatusBadge,
  type DataColumn,
} from "@cloud-dog/ui";
import { DashboardLayout } from "@cloud-dog/shell";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine } from "../lib/ui";
import type { RenderManifest } from "../lib/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { api, appVersion } = useChartState();
  const [counts, setCounts] = React.useState({ profiles: 0, sessions: 0, renders: 0, assets: 0, renderers: 0, jobs: 0 });
  const [recent, setRecent] = React.useState<RenderManifest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profiles, sessions, renders, assets, renderers, jobs] = await Promise.all([
        api.listProfiles().catch(() => []),
        api.listSessions().catch(() => []),
        api.listRenders().catch(() => []),
        api.listAssets().catch(() => []),
        api.listRenderers().catch(() => ({ allowed: {}, blocked: {} })),
        api.listJobs().catch(() => []),
      ]);
      setCounts({
        profiles: profiles.length,
        sessions: sessions.length,
        renders: renders.length,
        assets: assets.length,
        renderers: Object.keys(renderers.allowed ?? {}).length,
        jobs: jobs.length,
      });
      setRecent(renders.slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const columns: DataColumn<RenderManifest>[] = [
    {
      id: "manifest_id",
      header: "Render",
      cell: (row) => <span className="font-mono text-xs">{row.manifest_id}</span>,
      sortable: true,
      sortValue: (row) => row.manifest_id,
    },
    { id: "chart_type", header: "Chart Type", cell: (row) => row.chart_type || "—", sortable: true, sortValue: (row) => row.chart_type ?? "" },
    { id: "renderer", header: "Renderer", cell: (row) => row.renderer || "—", sortable: true, sortValue: (row) => row.renderer ?? "" },
    { id: "status", header: "Status", cell: (row) => <StatusBadge value={row.status ?? "completed"} />, sortable: true, sortValue: (row) => row.status ?? "" },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "—"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" version={appVersion} description="Service health, chart inventory, and recent render activity.">
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} />

      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="Profiles" value={counts.profiles} />
            <MetricCard label="Sessions" value={counts.sessions} />
            <MetricCard label="Renders" value={counts.renders} />
            <MetricCard label="Assets" value={counts.assets} />
            <MetricCard label="Renderers" value={counts.renderers} />
            <MetricCard label="Jobs" value={counts.jobs} />
          </>
        }
        quickActions={
          <QuickActionBar
            actions={[
              { label: "Recommend a chart", onClick: () => navigate("/recommendations") },
              { label: "Renderer health", onClick: () => navigate("/renderer-health") },
              { label: "Settings", onClick: () => navigate("/settings") },
            ]}
          />
        }
        recentActivity={
          <DataTable
            columns={columns}
            rows={recent}
            emptyMessage="No renders yet."
            getRowId={(row) => row.manifest_id}
            tableId="chart-mcp-dashboard-recent"
          />
        }
      />
    </div>
  );
}
