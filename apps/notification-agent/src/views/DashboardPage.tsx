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
import { Card, CardContent, CardHeader, DataTable, MetricCard, createDataTableActionColumn } from '@cloud-dog/ui';
import type { DataColumn } from '@cloud-dog/ui';
import { DashboardLayout, VersionInfo } from '@cloud-dog/shell';
import { Activity, MessageSquare } from 'lucide-react';
import { useNotificationAgentState } from '../state/AppState';
import { LogTablePanel } from './LogTablePanel';
import type { RuntimeHealth, RuntimeStatus } from '../lib/api';

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
  if (!value || value === '0.1.0') return UI_BUILD_VERSION;
  return value;
}

function isSuccessfulDelivery(state: string | null | undefined): boolean {
  return ['delivered', 'sent', 'accepted'].includes(String(state ?? '').toLowerCase());
}

function isFailedDelivery(state: string | null | undefined): boolean {
  return ['failed', 'hard_failed', 'soft_failed', 'bounced', 'dead_lettered'].includes(String(state ?? '').toLowerCase());
}

export function DashboardPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null);
  const [status, setStatus] = React.useState('Loading dashboard data…');
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
      // CX-170: no raw ISO timestamps in operator-facing copy.
      setStatus('Dashboard updated.');
    } catch (error) {
      setStatus('');
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

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
      id: 'sent',
      header: 'Sent',
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
      header: 'Success %',
      sortable: true,
      sortValue: (row) => row.successRate ?? -1,
      cell: (row) => row.successRate == null ? 'N/A' : `${row.successRate}%`,
    },
    // NA-D-07 / NA-D-08: deep-link row actions for Audit & Log (channel-filtered) and Messages (channel-filtered).
    createDataTableActionColumn<ChannelDeliveryBreakdown>((row) => [
      {
        id: 'messages',
        label: 'Messages',
        icon: <MessageSquare className="h-4 w-4" />,
        href: () => `/messages?channel=${encodeURIComponent(row.channel)}`,
        title: () => `View messages for channel ${row.channel}`,
      },
      {
        id: 'log',
        label: 'Log',
        icon: <Activity className="h-4 w-4" />,
        href: () => `/diagnostics-audit?query=channel:${encodeURIComponent(row.channel)}`,
        title: () => `View Audit & Log entries for channel ${row.channel}`,
      },
    ]),
  ], []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <VersionInfo version={displayVersion(snapshot?.health?.version)} />
        </div>
        <p className="text-sm text-muted-foreground">Notification health, queue state and recent operational activity.</p>
        {/* NA-D-04: explain how the queue depth and pending deliveries reconcile. */}
        <p className="text-xs text-muted-foreground">
          Queue depth counts queued and in-flight deliveries (one message may fan-out into several). The per-channel breakdown below shows pending deliveries by channel.
          Session timeout status is placed in the standard footer.
        </p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {/* CX-180: API/MCP/A2A service status is shown once, in the top-right
          ServiceStatusBar cluster only. The dashboard body no longer duplicates
          it (healthWidgets omitted); business metrics remain below. */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="Channel count" value={snapshot?.status?.channel_count ?? snapshot?.channels ?? 'N/A'} />
            <MetricCard label="Messages sent (24h)" value={snapshot?.status?.messages_sent_24h ?? snapshot?.messages ?? 'N/A'} />
            <MetricCard label="Delivery success rate" value={snapshot?.status?.delivery_success_rate ?? (snapshot?.channelBreakdown.length ? (() => { const total = snapshot.channelBreakdown.reduce((s, r) => s + r.total, 0); const delivered = snapshot.channelBreakdown.reduce((s, r) => s + r.delivered, 0); return total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 'N/A'; })() : 'N/A')} unit={snapshot?.status?.delivery_success_rate != null || (snapshot?.channelBreakdown?.length && snapshot.channelBreakdown.some((r) => r.total > 0)) ? '%' : undefined} />
            {/* NA-D-04: queue depth counts in-flight deliveries reported by the
                backend /status surface; this is distinct from "pending Messages"
                because a single message can fan-out into multiple deliveries.
                If /status doesn't supply queue_depth, fall back to summing per
                channel pending deliveries so the number always reconciles. */}
            <MetricCard
              label="Queue depth (in-flight)"
              value={snapshot?.status?.queue_depth ?? (snapshot?.channelBreakdown.reduce((s, r) => s + r.pending, 0) ?? 'N/A')}
            />
          </>
        }
        quickActions={undefined}
        recentActivity={(
          /* NA-D-10: shared Audit / Recent Activity widget (mirrors expert-agent dashboard). */
          <LogTablePanel
            api={api}
            tableId="notification-dashboard-recent-activity"
            title="Recent activity"
            description="Live audit log tail (last 8 entries) — same data as Audit & Log."
            initialSurface="audit"
            limit={8}
            embedded={true}
            defaultVisibleColumns={[
              'who',
              'eventType',
              'action',
              'target',
              'outcome',
              'severity',
              'timestamp',
            ]}
          />
        )}
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
              selectable
              bulkActions={[{ label: 'Export', action: 'export' }]}
              onBulkAction={(action, selectedIds) => {
                if (action !== 'export') return;
                // CX-101: JSON blob-download of the selected channel breakdown rows.
                const payload = (snapshot?.channelBreakdown ?? []).filter((row) => selectedIds.includes(row.channel));
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'notification-dashboard-channel-breakdown.json';
                link.click();
                URL.revokeObjectURL(url);
              }}
            />
          </CardContent>
        </Card>
      </DashboardLayout>
    </div>
  );
}
