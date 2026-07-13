import * as React from 'react';
import { DashboardLayout } from '@cloud-dog/shell';
import { Button, MetricCard } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { QueueStatus, StatusPayload } from '../lib/api';
import { PageScaffold } from './shared';
import { LogTablePanel } from './LogTablePanel';


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

  // W28E-1837 / CX-180: API/MCP/A2A status lives in the shell ServiceStatusBar
  // (App.tsx ShellAppChrome) — not duplicated in the body. HealthWidget rows
  // and the healthWidgets prop are removed from DashboardLayout here.

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        Loading dashboard...
      </div>
    );
  }

  return (
    <PageScaffold title="Dashboard" description="Operational landing view with live capacity and recent activity." alert={latestFailure}>
      <DashboardLayout
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
      >
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </DashboardLayout>
    </PageScaffold>
  );
}
