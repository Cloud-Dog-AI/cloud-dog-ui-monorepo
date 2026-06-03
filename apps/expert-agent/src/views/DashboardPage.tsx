import * as React from 'react';
import { DashboardLayout } from '@cloud-dog/shell';
import { HealthWidget, MetricCard } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { QueueStatus, StatusPayload } from '../lib/api';
import { LoadingNote, PageScaffold } from './shared';
import { LogTablePanel } from './LogTablePanel';

function formatUptime(seconds?: number): string {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function DashboardPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [status, setStatus] = React.useState<StatusPayload | null>(null);
  const [queue, setQueue] = React.useState<QueueStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [statusPayload, queuePayload] = await Promise.all([
        api.getStatus(),
        api.getQueueStatus(),
      ]);
      setStatus(statusPayload);
      setQueue(queuePayload);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <PageScaffold title="Dashboard" description="Operational landing view with live health, capacity, and recent activity." alert={latestFailure}>
      <LoadingNote loading={loading} />
      <DashboardLayout
        healthWidgets={[
          <HealthWidget key="api" name="API" status={status?.status === 'ok' || status?.status === 'healthy' || status?.status === 'up' ? 'ok' : status ? 'error' : 'unknown'} detail={`Uptime ${formatUptime(status?.uptime_seconds)}`} />,
          <HealthWidget key="queue" name="Queue" status={(queue?.queue_depth ?? 0) > 0 ? 'warning' : 'ok'} detail={`Depth ${queue?.queue_depth ?? 0}`} />,
          <HealthWidget key="sessions" name="Sessions" status={status ? 'ok' : 'unknown'} detail={`${status?.active_sessions ?? 0} active`} />,
        ]}
        metricCards={[
          <MetricCard key="experts" label="Experts" value={status?.expert_count ?? 'N/A'} />,
          <MetricCard key="knowledge" label="Knowledge" value={status?.knowledge_item_count ?? 'N/A'} />,
          <MetricCard key="channels" label="Channels" value={status?.channel_count ?? 'N/A'} />,
          <MetricCard key="cpu" label="CPU" value={status?.cpu_percent != null ? status.cpu_percent.toFixed(1) : 'N/A'} unit="%" />,
          <MetricCard key="memory" label="Memory" value={status?.memory_mb != null ? status.memory_mb.toFixed(0) : 'N/A'} unit="MB" />,
          <MetricCard key="disk" label="Disk" value={status?.disk_percent != null ? status.disk_percent.toFixed(1) : 'N/A'} unit="%" />,
          <MetricCard key="queue-depth" label="Queue Depth" value={queue?.queue_depth ?? status?.queue_depth ?? 'N/A'} />,
          <MetricCard key="active-jobs" label="Active Jobs" value={queue?.active_jobs ?? status?.active_jobs ?? 'N/A'} />,
        ]}
        recentActivity={(
          <LogTablePanel
            api={api}
            tableId="expert-agent-dashboard-logs"
            title="Recent activity"
            description="Audit and service log activity with switchable sources."
            initialSurface="audit"
            limit={8}
            embedded={true}
            defaultVisibleColumns={[
              'who',
              'from',
              'eventType',
              'action',
              'target',
              'outcome',
              'severity',
              'timestamp',
              'service',
            ]}
          />
        )}
      />
    </PageScaffold>
  );
}
