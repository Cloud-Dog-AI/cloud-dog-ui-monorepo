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

// @cloud-dog/app-expert-agent — Monitoring page with NIST AU-3 audit log DataTable.
// Covers: W28A-641 R1-R6, W28A-642, PS-40 L3

import * as React from 'react';
import { ResourceMetrics, type MetricItem } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import { LoadingNote, PageScaffold } from './shared';
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
  const channelId = params.get('filter_channel');
  if (channelId) return `channels/${channelId}`;
  const sessionId = params.get('filter_session');
  if (sessionId) return `sessions/${sessionId}`;
  return params.get('query') ?? '';
}

export function MonitoringPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [metrics, setMetrics] = React.useState<MetricItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initialLogQuery, setInitialLogQuery] = React.useState(readLogFilterFromLocation);

  const refreshMetrics = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [status, queue] = await Promise.all([
        api.getStatus(),
        api.getQueueStatus(),
      ]);
      setMetrics([
        { label: 'Uptime', value: formatUptimeHuman(status.uptime_seconds) },
        { label: 'Memory', value: asMetricValue(status.memory_mb), unit: 'MB' },
        { label: 'Memory %', value: asMetricValue(status.memory_percent), unit: '%' },
        { label: 'CPU', value: asMetricValue(status.cpu_percent), unit: '%' },
        { label: 'Disk', value: asMetricValue(status.disk_percent), unit: '%' },
        { label: 'Connections', value: asMetricValue(status.active_connections) },
        { label: 'Sessions', value: asMetricValue(status.active_sessions) },
        { label: 'Experts', value: asMetricValue(status.expert_count) },
        { label: 'Knowledge', value: asMetricValue(status.knowledge_item_count) },
        { label: 'Channels', value: asMetricValue(status.channel_count) },
        { label: 'Queue depth', value: asMetricValue(queue.queue_depth ?? status.queue_depth) },
        { label: 'Active jobs', value: asMetricValue(queue.active_jobs ?? status.active_jobs) },
      ]);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void refreshMetrics();
    const timer = window.setInterval(() => { void refreshMetrics(); }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshMetrics]);

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
    <PageScaffold title="Monitoring" description="PS-40 compliant audit log viewer with NIST AU-3 field display and resource metrics." alert={latestFailure}>
      <LoadingNote loading={loading} />
      <ResourceMetrics metrics={metrics} />
      <LogTablePanel
        api={api}
        tableId="expert-agent-monitoring-logs"
        title="Audit & application logs"
        description="PS-40 NIST AU-3 compliant log entries with multi-server source selection."
        initialSurface="audit"
        initialQuery={initialLogQuery}
        limit={500}
        defaultVisibleColumns={[
          'who',
          'from',
          'eventType',
          'action',
          'target',
          'outcome',
          'severity',
          'timestamp',
          'traceId',
          'service',
        ]}
      />
    </PageScaffold>
  );
}
