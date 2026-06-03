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

// @cloud-dog/app-notification-agent — Monitoring page aligned to expert-agent canonical reference.
// Covers: UI-R11, UI-R25, W28A-644, W28A-312

import * as React from 'react';
import { ResourceMetrics, type MetricItem } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import { LogTablePanel } from './LogTablePanel';

function asMetricValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  return String(value);
}

function formatUptimeHuman(seconds: number | string | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds === '') return 'N/A';
  const numeric = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(numeric) || numeric < 0) return String(seconds);
  const days = Math.floor(numeric / 86400);
  const hours = Math.floor((numeric % 86400) / 3600);
  const minutes = Math.floor((numeric % 3600) / 60);
  const secs = Math.floor(numeric % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function readLogFilterFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const [, hashQuery = ''] = window.location.hash.split('?');
  const queryString = window.location.search ? window.location.search.slice(1) : hashQuery;
  const params = new URLSearchParams(queryString);
  const jobId = params.get('job_id');
  if (jobId) return `job_id:${jobId}`;
  const channelId = params.get('filter_channel');
  if (channelId) return `channels/${channelId}`;
  return params.get('query') ?? '';
}

export function MonitoringPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [metrics, setMetrics] = React.useState<MetricItem[]>([]);
  const [initialLogQuery, setInitialLogQuery] = React.useState(readLogFilterFromLocation);

  const load = React.useCallback(async () => {
    clearFailure();
    try {
      const status = await api.getStatus();
      setMetrics([
        { label: 'Uptime', value: formatUptimeHuman(status.uptime_seconds) },
        { label: 'Memory', value: asMetricValue(status.memory_mb), unit: 'MB' },
        { label: 'CPU', value: asMetricValue(status.cpu_percent), unit: '%' },
        { label: 'Disk', value: asMetricValue(status.disk_percent), unit: '%' },
        { label: 'Connections', value: asMetricValue(status.active_connections) },
        { label: 'Queue depth', value: asMetricValue(status.queue_depth) },
        { label: 'Delivery rate', value: asMetricValue(status.delivery_success_rate), unit: '%' },
        { label: 'Retry queue', value: asMetricValue(status.retry_queue_size) },
      ]);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    const refreshFilter = () => setInitialLogQuery(readLogFilterFromLocation());
    window.addEventListener('popstate', refreshFilter);
    window.addEventListener('hashchange', refreshFilter);
    refreshFilter();
    return () => {
      window.removeEventListener('popstate', refreshFilter);
      window.removeEventListener('hashchange', refreshFilter);
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Monitoring</h1>
        <p className="text-sm text-muted-foreground">Audit and application log viewer with resource metrics.</p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}

      <ResourceMetrics metrics={metrics} />

      <LogTablePanel
        api={api}
        tableId="notification-monitoring-logs"
        title="Audit & application logs"
        description=""
        initialSurface="audit"
        initialQuery={initialLogQuery}
        limit={500}
        defaultVisibleColumns={[
          'who',
          'from',
          'eventType',
          'action',
          'target',
          'channel',
          'outcome',
          'severity',
          'timestamp',
          'traceId',
          'service',
        ]}
      />
    </div>
  );
}
