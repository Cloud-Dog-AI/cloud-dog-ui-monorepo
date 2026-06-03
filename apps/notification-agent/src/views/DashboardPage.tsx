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

// @cloud-dog/app-notification-agent — Operational dashboard backed by live admin APIs.
// Covers: FR1.27, FR1.31, FR1.32, FR1.33, UI-R23, W28A-644

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, DataTable, HealthWidget, MetricCard, RelativeTime } from '@cloud-dog/ui';
import type { DataColumn } from '@cloud-dog/ui';
import type { HealthStatus } from '@cloud-dog/ui';
import { CopyrightFooter, DashboardLayout, VersionInfo } from '@cloud-dog/shell';
import { useConfig } from '@cloud-dog/config';
import { useNotificationAgentState } from '../state/AppState';
import type { RuntimeHealth, RuntimeStatus } from '../lib/api';

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
}>;

type ChannelDeliveryBreakdown = Readonly<{
  channel: string;
  type: string;
  enabled: string;
  delivered: number;
  pending: number;
  failed: number;
  total: number;
  successRate: number | null;
}>;

type DashboardSnapshot = Readonly<{
  users: number;
  groups: number;
  channels: number;
  messages: number;
  deliveries: number;
  prompts: number;
  apiKeys: number;
  jobs: number;
  health: RuntimeHealth | null;
  status: RuntimeStatus | null;
  recentMessages: Array<Readonly<{
    id: number;
    subject: string;
    status: string;
    timestamp?: string | null;
  }>>;
  channelBreakdown: ChannelDeliveryBreakdown[];
}>;

const importMetaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const UI_BUILD_VERSION = importMetaEnv.VITE_APP_VERSION
  ?? importMetaEnv.VITE_GIT_SHA
  ?? 'notification-webui-2026.05.28';

function displayVersion(version: string | null | undefined): string {
  const value = String(version ?? '').trim();
  if (!value) return UI_BUILD_VERSION;
  return value;
}

function isSuccessfulDelivery(state: string | null | undefined): boolean {
  return ['delivered', 'sent', 'accepted'].includes(String(state ?? '').toLowerCase());
}

function isFailedDelivery(state: string | null | undefined): boolean {
  return ['failed', 'hard_failed', 'soft_failed', 'bounced', 'dead_lettered'].includes(String(state ?? '').toLowerCase());
}

export function DashboardPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null);
  const [status, setStatus] = React.useState('Loading dashboard data…');
  const [serviceState, setServiceState] = React.useState<{
    api: HealthStatus;
    mcp: HealthStatus;
    a2a: HealthStatus;
  }>({
    api: 'unknown' as const,
    mcp: 'unknown' as const,
    a2a: 'unknown' as const,
  });
  const [channelPage, setChannelPage] = React.useState(1);
  const [channelPageSize, setChannelPageSize] = React.useState(5);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setStatus('Refreshing dashboard…');
    try {
      const [users, groups, channels, messages, deliveries, prompts, apiKeys, jobs, runtimeStatus, health] = await Promise.all([
        api.listUsers(),
        api.listGroups(),
        api.listChannels(),
        api.listMessages(),
        api.listDeliveries(),
        api.listPrompts(),
        api.listAdminApiKeys(),
        api.listJobs(100),
        api.getStatus(),
        api.getHealth(),
      ]);

      const mcpBase = cfg.MCP_BASE_URL || '';
      const a2aBase = cfg.A2A_BASE_URL || '';
      const [mcpHealth, a2aHealth] = await Promise.all([
        mcpBase ? fetch(`${mcpBase}/health`, { credentials: 'same-origin' }).then((response) => response.ok).catch(() => false) : Promise.resolve(false),
        a2aBase ? fetch(`${a2aBase}/health`, { credentials: 'same-origin' }).then((response) => response.ok).catch(() => false) : Promise.resolve(false),
      ]);

      setSnapshot({
        users: users.length,
        groups: groups.length,
        channels: channels.length,
        messages: messages.length,
        deliveries: deliveries.length,
        prompts: prompts.length,
        apiKeys: apiKeys.length,
        jobs: jobs.length,
        health,
        status: runtimeStatus,
        recentMessages: messages.slice(0, 8).map((message) => ({
          id: message.id,
          subject: message.subject ?? 'Untitled message',
          status: message.status ?? 'unknown',
          timestamp: message.created_at ?? null,
        })),
        channelBreakdown: channels
          .map((channel) => {
            const channelDeliveries = deliveries.filter((delivery) => delivery.channel_name === channel.name);
            const delivered = channelDeliveries.filter((delivery) => isSuccessfulDelivery(delivery.state)).length;
            const failed = channelDeliveries.filter((delivery) => isFailedDelivery(delivery.state)).length;
            const pending = channelDeliveries.length - delivered - failed;
            return {
              channel: channel.name,
              type: channel.type,
              enabled: channel.enabled !== false ? 'Enabled' : 'Disabled',
              delivered,
              pending,
              failed,
              total: channelDeliveries.length,
              successRate: channelDeliveries.length ? Number(((delivered / channelDeliveries.length) * 100).toFixed(1)) : null,
            };
          })
          .sort((left, right) => right.total - left.total || left.channel.localeCompare(right.channel)),
      });
      setServiceState({
        api: health.status === 'ok' ? 'ok' : 'error',
        mcp: mcpHealth ? 'ok' : 'warning',
        a2a: a2aHealth ? 'ok' : 'warning',
      });
      setStatus(`Dashboard updated at ${runtimeStatus.timestamp ?? new Date().toISOString()}.`);
    } catch (error) {
      setStatus('');
      captureFailure(error);
    }
  }, [api, captureFailure, cfg.A2A_BASE_URL, cfg.API_BASE_URL, cfg.MCP_BASE_URL, clearFailure]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const channelColumns = React.useMemo<DataColumn<ChannelDeliveryBreakdown>[]>(() => [
    {
      id: 'channel',
      header: 'Channel',
      sortable: true,
      sortValue: (row) => row.channel,
      cell: (row) => row.channel,
    },
    {
      id: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (row) => row.type,
      cell: (row) => row.type,
    },
    {
      id: 'enabled',
      header: 'State',
      sortable: true,
      sortValue: (row) => row.enabled,
      cell: (row) => row.enabled,
    },
    {
      id: 'delivered',
      header: 'Delivered',
      sortable: true,
      sortValue: (row) => row.delivered,
      cell: (row) => String(row.delivered),
    },
    {
      id: 'pending',
      header: 'Pending',
      sortable: true,
      sortValue: (row) => row.pending,
      cell: (row) => String(row.pending),
    },
    {
      id: 'failed',
      header: 'Failed',
      sortable: true,
      sortValue: (row) => row.failed,
      cell: (row) => String(row.failed),
    },
    {
      id: 'successRate',
      header: 'Success rate',
      sortable: true,
      sortValue: (row) => row.successRate ?? -1,
      cell: (row) => row.successRate == null ? 'N/A' : `${row.successRate}%`,
    },
  ], []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <VersionInfo version={displayVersion(snapshot?.health?.version)} />
        </div>
        <p className="text-sm text-muted-foreground">Notification health, queue state and recent operational activity.</p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <DashboardLayout
        healthWidgets={
          <>
            <HealthWidget name="API" status={serviceState.api} detail={snapshot?.health?.status ?? 'N/A'} url={cfg.API_BASE_URL} />
            <HealthWidget name="MCP" status={serviceState.mcp} detail={cfg.MCP_BASE_URL || 'Not configured'} url={cfg.MCP_BASE_URL || undefined} />
            <HealthWidget name="A2A" status={serviceState.a2a} detail={cfg.A2A_BASE_URL || 'Not configured'} url={cfg.A2A_BASE_URL || undefined} />
          </>
        }
        metricCards={
          <>
            <MetricCard label="Channel count" value={snapshot?.status?.channel_count ?? snapshot?.channels ?? 'N/A'} />
            <MetricCard label="Messages sent (24h)" value={snapshot?.status?.messages_sent_24h ?? snapshot?.messages ?? 'N/A'} />
            <MetricCard label="Delivery success rate" value={snapshot?.status?.delivery_success_rate ?? (snapshot?.channelBreakdown.length ? (() => { const total = snapshot.channelBreakdown.reduce((s, r) => s + r.total, 0); const delivered = snapshot.channelBreakdown.reduce((s, r) => s + r.delivered, 0); return total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 'N/A'; })() : 'N/A')} unit={snapshot?.status?.delivery_success_rate != null || (snapshot?.channelBreakdown?.length && snapshot.channelBreakdown.some((r) => r.total > 0)) ? '%' : undefined} />
            <MetricCard label="Queue depth" value={snapshot?.status?.queue_depth ?? 'N/A'} />
          </>
        }
        quickActions={
          <Button type="button" variant="secondary" onClick={() => { window.location.href = '/messages'; }}>
            Compose message
          </Button>
        }
        recentActivity={undefined}
      >
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Per-channel delivery breakdown</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="notification-dashboard-channel-breakdown"
              columns={channelColumns}
              rows={snapshot?.channelBreakdown ?? []}
              totalRows={snapshot?.channelBreakdown.length ?? 0}
              getRowId={(row) => row.channel}
              page={channelPage}
              onPageChange={setChannelPage}
              pageSize={channelPageSize}
              onPageSizeChange={setChannelPageSize}
              emptyMessage="No channel delivery data available."
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>
      </DashboardLayout>

      <CopyrightFooter />
    </div>
  );
}
