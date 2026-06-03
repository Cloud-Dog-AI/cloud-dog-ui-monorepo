import * as React from 'react';
import { Card, CardContent, CardHeader, StatusBadge } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type {
  ApiKeyRecord,
  AuditLogEntry,
  ChannelRecord,
  ExpertRecord,
  QueueStatus,
  RuntimeHealth,
  ServiceRecord,
  SessionRecord,
  StatusPayload,
} from '../lib/api';
import { AppDataTable } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatCount, renderRelativeTime } from './shared';

type ConnectionRow = Readonly<{
  id: number;
  expert: string;
  status: string;
  channels: string[];
  sessions: string[];
  services: string[];
  subExperts: string[];
}>;

function metricValue(value: number | null | undefined, fallback: string): string {
  if (typeof value === 'number' && !Number.isNaN(value)) return formatCount(value);
  return fallback;
}

function serviceLabel(service: ServiceRecord): string {
  return [
    service.name,
    service.service_type ?? 'service',
    service.health_status ?? 'health not reported',
  ].join(' / ');
}

export function AdminPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [health, setHealth] = React.useState<RuntimeHealth | null>(null);
  const [status, setStatus] = React.useState<StatusPayload | null>(null);
  const [queue, setQueue] = React.useState<QueueStatus | null>(null);
  const [services, setServices] = React.useState<ServiceRecord[]>([]);
  const [apiKeys, setApiKeys] = React.useState<ApiKeyRecord[]>([]);
  const [activity, setActivity] = React.useState<AuditLogEntry[]>([]);
  const [connections, setConnections] = React.useState<ConnectionRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [
        healthData,
        statusData,
        queueData,
        serviceData,
        apiKeyData,
        expertData,
        channelData,
        sessionData,
        logData,
      ] = await Promise.all([
        api.getHealth(),
        api.getStatus(),
        api.getQueueStatus(),
        api.listServices(),
        api.listApiKeys({ includeRevoked: true }),
        api.listExperts(),
        api.listChannels(),
        api.listSessions(),
        api.listLogs({ surface: 'audit', limit: 8 }),
      ]);

      const relationRows = await Promise.all(
        expertData.map(async (expert: ExpertRecord): Promise<ConnectionRow> => {
          const [boundServices, boundSubExperts] = await Promise.all([
            api.listExpertServices(expert.id).catch(() => []),
            api.listExpertSubExperts(expert.id).catch(() => []),
          ]);
          const expertChannels = channelData.filter((channel: ChannelRecord) => (channel.expert_config_id ?? channel.expert_id) === expert.id);
          const expertSessions = sessionData.filter((session: SessionRecord) => (session.expert_config_id ?? session.expert_id) === expert.id);
          return {
            id: expert.id,
            expert: expert.name,
            status: expert.enabled === false ? 'disabled' : 'active',
            channels: expertChannels.map((channel) => channel.name),
            sessions: expertSessions.map((session) => session.title ?? `Session ${session.id}`),
            services: boundServices.map((binding) => {
              const service = binding.service ?? serviceData.find((item) => item.id === binding.service_id);
              return service ? serviceLabel(service) : `Service ${binding.service_id}`;
            }),
            subExperts: boundSubExperts.map((binding) => binding.sub_expert?.name ?? `Expert ${binding.sub_expert_id}`),
          };
        })
      );

      setHealth(healthData);
      setStatus(statusData);
      setQueue(queueData);
      setServices(serviceData);
      setApiKeys(apiKeyData);
      setActivity(logData.entries ?? []);
      setConnections(relationRows);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <PageScaffold title="Admin" description="Live Expert Agent operations overview for administrators." alert={latestFailure}>
      <LoadingNote loading={loading} />

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Health</p></CardHeader>
          <CardContent>
            <StatusBadge value={health?.status ?? status?.status ?? 'not reported'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Queue depth</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{metricValue(queue?.queue_depth, 'Not reported by API')}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Active jobs</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{metricValue(queue?.active_jobs, 'Not reported by API')}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Connected services</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCount(services.length)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Experts</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCount(connections.length)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Channels</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCount(connections.reduce((sum, row) => sum + row.channels.length, 0))}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Sessions</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCount(connections.reduce((sum, row) => sum + row.sessions.length, 0))}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-sm font-medium text-muted-foreground">Active API keys</p></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCount(apiKeys.filter((item) => !item.revoked).length)}</p></CardContent>
        </Card>
      </div>

      <AppDataTable
        title="Connected entities"
        rows={connections}
        getRowId={(row) => String(row.id)}
        emptyMessage="No experts reported by the backend."
        itemLabel="experts"
        onRefresh={refresh}
        columns={[
          { id: 'expert', header: 'Expert', sortable: true, sortValue: (row) => row.expert, cell: (row) => row.expert },
          { id: 'status', header: 'Status', sortable: true, sortValue: (row) => row.status, cell: (row) => <StatusBadge value={row.status} /> },
          { id: 'channels', header: 'Channels', sortable: true, sortValue: (row) => row.channels.length, cell: (row) => row.channels.length ? row.channels.slice(0, 3).join(', ') : 'No channels reported' },
          { id: 'sessions', header: 'Sessions', sortable: true, sortValue: (row) => row.sessions.length, cell: (row) => row.sessions.length ? row.sessions.slice(0, 3).join(', ') : 'No sessions reported' },
          { id: 'services', header: 'Services', sortable: true, sortValue: (row) => row.services.length, cell: (row) => row.services.length ? row.services.slice(0, 3).join(', ') : 'No services bound' },
          { id: 'sub_experts', header: 'Sub-agents', sortable: true, sortValue: (row) => row.subExperts.length, cell: (row) => row.subExperts.length ? row.subExperts.slice(0, 3).join(', ') : 'No sub-agents bound' },
        ]}
        searchText={(row) => [row.expert, row.status, ...row.channels, ...row.sessions, ...row.services, ...row.subExperts].join(' ')}
      />

      <AppDataTable
        title="Recent activity"
        rows={activity}
        getRowId={(entry) => String(entry.id)}
        emptyMessage="No recent audit activity reported by the backend."
        itemLabel="events"
        onRefresh={refresh}
        columns={[
          { id: 'time', header: 'Time', sortable: true, sortValue: (entry) => entry.timestamp ?? '', cell: (entry) => renderRelativeTime(entry.timestamp) },
          { id: 'event', header: 'Event', sortable: true, sortValue: (entry) => entry.event_type ?? entry.action ?? '', cell: (entry) => entry.event_type ?? entry.action ?? 'event' },
          { id: 'outcome', header: 'Outcome', sortable: true, sortValue: (entry) => entry.outcome ?? '', cell: (entry) => entry.outcome ? <StatusBadge value={entry.outcome} /> : 'Not reported' },
          { id: 'message', header: 'Message', sortable: true, sortValue: (entry) => entry.message ?? '', cell: (entry) => entry.message ?? entry.target?.name ?? 'No message reported' },
        ]}
      />
    </PageScaffold>
  );
}
