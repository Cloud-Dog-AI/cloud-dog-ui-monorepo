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
import {
  HealthWidget,
  MetricCard,
  QuickActionBar,
  ResourceMetrics,
  type HealthStatus,
  type MetricItem,
  type QuickAction,
} from '@cloud-dog/ui';
import {
  ErrorState,
  LoadingState,
  PageFrame,
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

type SidecarStatus = {
  running?: boolean;
  status?: string;
  pid?: number;
};

function toHealthStatus(status: string | undefined, ready?: boolean, running?: boolean): HealthStatus {
  if (running === false) return 'error';
  const normalised = `${status ?? ''}`.toLowerCase();
  if (ready || running === true || normalised.includes('ready') || normalised.includes('healthy') || normalised.includes('running')) {
    return 'ok';
  }
  if (normalised.includes('warn') || normalised.includes('start') || normalised.includes('busy')) return 'warning';
  if (normalised.includes('error') || normalised.includes('fail') || normalised.includes('stopped')) return 'error';
  return 'unknown';
}

export function StatusPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const navigate = useNavigate();
  const status = useApiResource<StatusPayload>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/status'),
    [cfg.API_BASE_URL],
  );
  const mcp = useApiResource<SidecarStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/servers/mcp/status'),
    [cfg.API_BASE_URL],
  );
  const a2a = useApiResource<SidecarStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/servers/a2a/status'),
    [cfg.API_BASE_URL],
  );

  const actions = React.useMemo<QuickAction[]>(
    () => [
      { label: 'New Query', onClick: () => navigate('/query') },
      { label: 'Browse Tables', onClick: () => navigate('/tables') },
      { label: 'View Jobs', onClick: () => navigate('/jobs') },
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

  return (
    <PageFrame
      eyebrow="FR-58"
      title="Dashboard"
      description="Review live health, resource usage, service metrics, and recent query activity without dropping into raw JSON."
    >
      <QuickActionBar actions={actions} />

      {status.loading ? <LoadingState label="dashboard status" /> : null}
      {status.error ? <ErrorState message={status.error} /> : null}

      <div className="space-y-6">
        {!status.loading && !status.error ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
            <HealthWidget
              name="API"
              status={toHealthStatus(status.data?.status, status.data?.ready)}
              detail={status.data?.message ?? 'N/A'}
            />
            <HealthWidget
              name="MCP"
              status={toHealthStatus(mcp.data?.status, false, mcp.data?.running)}
              detail={mcp.data?.pid != null ? `PID ${mcp.data.pid}` : 'N/A'}
            />
            <HealthWidget
              name="A2A"
              status={toHealthStatus(a2a.data?.status, false, a2a.data?.running)}
              detail={a2a.data?.pid != null ? `PID ${a2a.data.pid}` : 'N/A'}
            />
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Connected DBs" value={status.data?.service_metrics?.connected_database_count ?? 'N/A'} />
            <MetricCard label="Tables" value={status.data?.service_metrics?.table_count ?? status.data?.tables ?? 'N/A'} />
            <MetricCard label="Context Tables" value={status.data?.service_metrics?.context_table_count ?? status.data?.tables_loaded ?? 'N/A'} />
            <MetricCard label="Queries" value={status.data?.service_metrics?.query_count ?? status.data?.job_manager?.total_jobs ?? 'N/A'} />
            </div>
          </>
        ) : null}

        <PanelCard title="Resource metrics" subtitle="Live runtime values from `/api/v1/status`">
          <ResourceMetrics metrics={resourceMetrics} />
        </PanelCard>

        {!status.loading && !status.error ? (
          <PanelCard title="Recent audit activity" subtitle="Latest audit and server entries visible through the authenticated Web proxy.">
            <LogExplorer
              apiBaseUrl={cfg.API_BASE_URL}
              defaultLines={40}
              defaultPageSize={5}
              defaultSource="audit"
              tableId="sql-agent-dashboard-log-explorer"
            />
          </PanelCard>
        ) : null}
      </div>
    </PageFrame>
  );
}
