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

// @cloud-dog/app-sql-agent — Dashboard and operational status panel.

// Covers: FR-58

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '@cloud-dog/config';
import { DashboardLayout } from '@cloud-dog/shell';
import {
  MetricCard,
  QuickActionBar,
  ResourceMetrics,
  type MetricItem,
  type QuickAction,
} from '@cloud-dog/ui';
import {
  PanelCard,
  requestJson,
  useApiResource,
} from '../lib/sqlAgentApi';
import { LogExplorer } from '../components/LogExplorer';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type StatusPayload = {
  status?: string;
  ready?: boolean;
  message?: string;
  tables?: number;
  tables_loaded?: number;
  llm_model?: string;
  job_manager?: {
    total_jobs?: number;
    running?: number;
    pending?: number;
  };
  resource_metrics?: {
    uptime_seconds?: number;
    memory_mb?: number;
    memory_percent?: number;
    cpu_percent?: number;
    disk_percent?: number;
    active_connections?: number;
  };
  service_metrics?: {
    connected_database_count?: number;
    table_count?: number;
    context_table_count?: number;
    query_count?: number;
  };
};

export function StatusPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const navigate = useNavigate();
  const status = useApiResource<StatusPayload>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/status'),
    [cfg.API_BASE_URL],
  );

  const actions = React.useMemo<QuickAction[]>(
    () => [
      { label: 'New Query', onClick: () => navigate('/query') },
      { label: 'Browse Tables', onClick: () => navigate('/tables') },
      { label: 'View Jobs', onClick: () => navigate('/system/jobs') },
    ],
    [navigate],
  );

  const resourceMetrics = React.useMemo<MetricItem[]>(() => {
    const metrics = status.data?.resource_metrics;
    return [
      { label: 'Uptime', value: metrics?.uptime_seconds != null ? `${metrics.uptime_seconds}` : 'N/A', unit: 's' },
      { label: 'Memory', value: metrics?.memory_mb != null ? `${metrics.memory_mb}` : 'N/A', unit: 'MB' },
      { label: 'CPU', value: metrics?.cpu_percent != null ? `${metrics.cpu_percent}` : 'N/A', unit: '%' },
      { label: 'Disk', value: metrics?.disk_percent != null ? `${metrics.disk_percent}` : 'N/A', unit: '%' },
      { label: 'Connections', value: metrics?.active_connections != null ? `${metrics.active_connections}` : 'N/A' },
      { label: 'Memory %', value: metrics?.memory_percent != null ? `${metrics.memory_percent}` : 'N/A', unit: '%' },
    ];
  }, [status.data?.resource_metrics]);

  if (status.loading) {
    return (
      <div className="flex min-h-[40vh] items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* W28E-1837 / CX-180: canonical dashboard header — single h1 + Refresh. */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => status.refresh()}
          >
            Refresh
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Review live resource usage, service metrics, and recent query activity.
        </p>
      </header>

      {status.error ? (
        <p role="alert" className="text-sm text-destructive">{status.error}</p>
      ) : null}

      {/* W28E-1837 / STD-F02: canonical DashboardLayout — metric row + quick actions +
          recent-activity table; ResourceMetrics detail panel in children.
          CX-180: API/MCP/A2A status lives in the shell top-bar only (App.tsx); body
          status rows removed per CX-180. */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="Connected DBs" value={status.data?.service_metrics?.connected_database_count ?? 'N/A'} />
            <MetricCard label="Tables" value={status.data?.service_metrics?.table_count ?? status.data?.tables ?? 'N/A'} />
            <MetricCard label="Context Tables" value={status.data?.service_metrics?.context_table_count ?? status.data?.tables_loaded ?? 'N/A'} />
            <MetricCard label="Queries" value={status.data?.service_metrics?.query_count ?? status.data?.job_manager?.total_jobs ?? 'N/A'} />
          </>
        }
        quickActions={<QuickActionBar actions={actions} />}
        recentActivity={
          <PanelCard title="Recent audit activity" subtitle="Latest audit and server entries visible through the authenticated Web proxy.">
            <LogExplorer
              apiBaseUrl={cfg.API_BASE_URL}
              defaultLines={40}
              defaultPageSize={5}
              defaultSource="audit"
              tableId="sql-agent-dashboard-log-explorer"
            />
          </PanelCard>
        }
      >
        {/* ResourceMetrics live polling panel (service-extension slot). */}
        <PanelCard title="Resource metrics" subtitle="Live runtime values from `/api/v1/status`">
          <ResourceMetrics metrics={resourceMetrics} />
        </PanelCard>
      </DashboardLayout>
    </div>
  );
}
