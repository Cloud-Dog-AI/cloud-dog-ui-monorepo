import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  Select,
  StructuredView,
  Switch,
  type DataColumn,
} from '@cloud-dog/ui';
import { Download } from 'lucide-react';
import type { AuditLogEntry, ExpertAgentApi, LogSurfaceId, LogsResponse } from '../lib/api';

const DEFAULT_LOG_SURFACES: Array<{ id: LogSurfaceId; label: string }> = [
  { id: 'audit', label: 'Audit' },
  { id: 'api', label: 'API' },
  { id: 'web', label: 'Web' },
  { id: 'mcp', label: 'MCP' },
  { id: 'a2a', label: 'A2A' },
];

function formatLocalTimestamp(value?: string | null): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatActor(value?: AuditLogEntry['actor'] | null): string {
  const actorType = value?.type ?? 'unknown';
  const actorId = value?.id ?? 'N/A';
  return `${actorType}:${actorId}`;
}

function formatTarget(value?: AuditLogEntry['target'] | null): string {
  const targetType = value?.type ?? 'unknown';
  const targetId = value?.id ?? 'N/A';
  return `${targetType}:${targetId}`;
}

function formatService(row: AuditLogEntry): string {
  const serviceName = row.service ?? 'N/A';
  const serviceInstance = row.service_instance ?? 'N/A';
  return `${serviceName} / ${serviceInstance}`;
}

function detailsSummary(value: Record<string, unknown> | null | undefined): string {
  if (!value) return 'N/A';
  const parts = Object.entries(value)
    .slice(0, 3)
    .map(([key, item]) => `${key}=${typeof item === 'string' ? item : JSON.stringify(item)}`);
  return parts.length ? parts.join(' | ') : 'N/A';
}

function searchText(row: AuditLogEntry): string {
  return [
    row.surface_label,
    row.message,
    row.logger,
    row.event_type,
    row.action,
    row.outcome,
    row.severity,
    row.trace_id,
    row.request_id,
    row.service,
    row.service_instance,
    row.environment,
    row.actor?.type,
    row.actor?.id,
    row.actor?.ip,
    row.actor?.roles?.join(' '),
    row.actor?.user_agent,
    row.target?.type,
    row.target?.id,
    row.target?.name,
    row.source_path,
    row.timestamp,
    row.details ? JSON.stringify(row.details) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

type LogTablePanelProps = Readonly<{
  api: ExpertAgentApi;
  tableId: string;
  title: string;
  description: string;
  initialSurface?: LogSurfaceId;
  initialQuery?: string;
  limit?: number;
  embedded?: boolean;
  defaultVisibleColumns: string[];
}>;

export function LogTablePanel(props: LogTablePanelProps) {
  const {
    api,
    tableId,
    title,
    description,
    initialSurface = 'audit',
    initialQuery = '',
    limit = 100,
    embedded = false,
    defaultVisibleColumns,
  } = props;
  const [surface, setSurface] = React.useState<LogSurfaceId>(initialSurface);
  const [payload, setPayload] = React.useState<LogsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(limit <= 10 ? limit : 25);
  const [query, setQuery] = React.useState(initialQuery);
  const [selectedEntry, setSelectedEntry] = React.useState<AuditLogEntry | null>(null);

  const [tableReady, setTableReady] = React.useState(typeof window === 'undefined');
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setTableReady(true);
      return;
    }
    const storageKey = `dt.cols.${tableId}`;
    try {
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(defaultVisibleColumns));
      }
    } catch {
      // Ignore localStorage failures and continue with DataTable defaults.
    }
    setTableReady(true);
  }, [defaultVisibleColumns, tableId]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.listLogs({
        surface,
        limit,
        query: query.trim() || undefined,
      });
      setPayload(next);

      setStatus(
        `Loaded ${next.count} ${next.surface_label ?? surface.toUpperCase()} entries from ${next.source_path ?? 'configured source'}.`
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [api, limit, query, surface]);

  React.useEffect(() => {
    void refresh();
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refresh, autoRefresh]);

  React.useEffect(() => {
    setPage(1);
    setSelectedEntry(null);
  }, [surface, query]);

  React.useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const availableSurfaces = payload?.available_surfaces?.length
    ? payload.available_surfaces
    : DEFAULT_LOG_SURFACES;

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (payload?.entries ?? []).filter((row) => {
      if (!needle) return true;
      return searchText(row).includes(needle);
    });
  }, [payload?.entries, query]);

  const columns = React.useMemo<DataColumn<AuditLogEntry>[]>(() => [
    {
      id: 'who',
      header: 'Who',
      sortable: true,
      sortValue: (row) => `${row.actor?.type ?? ''}:${row.actor?.id ?? ''}`,
      cell: (row) => <span className="font-mono text-xs">{formatActor(row.actor)}</span>,
    },
    {
      id: 'from',
      header: 'From',
      sortable: true,
      sortValue: (row) => row.actor?.ip ?? '',
      cell: (row) => <span className="font-mono text-xs">{row.actor?.ip ?? 'N/A'}</span>,
    },
    {
      id: 'eventType',
      header: 'Event Type',
      sortable: true,
      sortValue: (row) => row.event_type ?? '',
      cell: (row) => row.event_type ?? 'N/A',
    },
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (row) => row.action ?? '',
      cell: (row) => row.action ?? 'N/A',
    },
    {
      id: 'target',
      header: 'Target',
      sortable: true,
      sortValue: (row) => `${row.target?.type ?? ''}:${row.target?.id ?? ''}`,
      cell: (row) => <span className="font-mono text-xs">{formatTarget(row.target)}</span>,
    },
    {
      id: 'outcome',
      header: 'Outcome',
      sortable: true,
      sortValue: (row) => row.outcome ?? '',
      cell: (row) => row.outcome ?? 'N/A',
    },
    {
      id: 'severity',
      header: 'Severity',
      sortable: true,
      sortValue: (row) => row.severity ?? row.level ?? '',
      cell: (row) => row.severity ?? row.level ?? 'N/A',
    },
    {
      id: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      sortValue: (row) => row.timestamp ?? '',
      cell: (row) => <span className="font-mono text-xs">{formatLocalTimestamp(row.timestamp)}</span>,
    },
    {
      id: 'traceId',
      header: 'Trace ID',
      sortable: true,
      sortValue: (row) => row.trace_id ?? '',
      cell: (row) => <span className="font-mono text-xs break-all">{row.trace_id ?? 'N/A'}</span>,
    },
    {
      id: 'requestId',
      header: 'Request ID',
      sortable: true,
      sortValue: (row) => row.request_id ?? '',
      cell: (row) => <span className="font-mono text-xs break-all">{row.request_id ?? 'N/A'}</span>,
    },
    {
      id: 'service',
      header: 'Service',
      sortable: true,
      sortValue: (row) => `${row.service ?? ''}:${row.service_instance ?? ''}`,
      cell: (row) => <span className="font-mono text-xs">{formatService(row)}</span>,
    },
    {
      id: 'actorRoles',
      header: 'Actor Roles',
      sortable: true,
      sortValue: (row) => row.actor?.roles?.join(',') ?? '',
      cell: (row) => row.actor?.roles?.length ? row.actor.roles.join(', ') : 'N/A',
    },
    {
      id: 'userAgent',
      header: 'User Agent',
      sortable: true,
      sortValue: (row) => row.actor?.user_agent ?? '',
      cell: (row) => <span className="font-mono text-xs break-all">{row.actor?.user_agent ?? 'N/A'}</span>,
    },
    {
      id: 'targetName',
      header: 'Target Name',
      sortable: true,
      sortValue: (row) => row.target?.name ?? '',
      cell: (row) => row.target?.name ?? 'N/A',
    },
    {
      id: 'details',
      header: 'Details',
      sortable: true,
      sortValue: (row) => detailsSummary(row.details),
      cell: (row) => <span className="font-mono text-xs break-all">{detailsSummary(row.details)}</span>,
    },
    {
      id: 'message',
      header: 'Message',
      sortable: true,
      sortValue: (row) => row.message ?? '',
      cell: (row) => <span className="font-mono text-xs break-all">{row.message ?? 'N/A'}</span>,
    },
    {
      id: 'source',
      header: 'Source',
      sortable: true,
      sortValue: (row) => row.surface_label ?? row.surface,
      cell: (row) => row.surface_label ?? row.surface.toUpperCase(),
    },
    {
      id: 'environment',
      header: 'Environment',
      sortable: true,
      sortValue: (row) => row.environment ?? '',
      cell: (row) => row.environment ?? 'N/A',
    },
    {
      id: 'inspect',
      header: 'Inspect',
      cell: (row) => (
        <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedEntry(row)}>
          View
        </Button>
      ),
    },
  ], []);

  const exportRows = React.useCallback((format: 'json' | 'csv') => {
    if (!rows.length) return;
    let content: string;
    let mime: string;
    if (format === 'json') {
      content = JSON.stringify(rows, null, 2);
      mime = 'application/json';
    } else {
      const headers = ['timestamp', 'event_type', 'action', 'outcome', 'severity', 'actor_type', 'actor_id', 'actor_ip', 'target_type', 'target_id', 'target_name', 'trace_id', 'service', 'message'];
      const csvRows = rows.map((row) => headers.map((h) => {
        let val: unknown;
        if (h === 'actor_type') val = row.actor?.type;
        else if (h === 'actor_id') val = row.actor?.id;
        else if (h === 'actor_ip') val = row.actor?.ip;
        else if (h === 'target_type') val = row.target?.type;
        else if (h === 'target_id') val = row.target?.id;
        else if (h === 'target_name') val = row.target?.name;
        else val = (row as Record<string, unknown>)[h];
        const str = val == null ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','));
      content = [headers.join(','), ...csvRows].join('\n');
      mime = 'text/csv';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${surface}-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, surface]);

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Log source</span>
          <Select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Log source"
            value={surface}
            onChange={(event) => setSurface(event.target.value as LogSurfaceId)}
          >
            {availableSurfaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
          <span>Search</span>
          <Input
            aria-label="Search logs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by actor, action, target, trace ID, request ID, or message"
            data-testid="logs-search-input"
          />
        </label>

        <div className="flex items-center gap-2 text-sm">
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Auto-refresh" />
          <span className="text-muted-foreground">Auto-refresh</span>
        </div>

        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Refresh
        </Button>

        <Button type="button" variant="secondary" onClick={() => exportRows('json')} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-1" /> JSON
        </Button>
        <Button type="button" variant="secondary" onClick={() => exportRows('csv')} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Current source: {payload?.surface_label ?? availableSurfaces.find((item) => item.id === surface)?.label ?? surface.toUpperCase()}</p>
        <p>Path: {payload?.source_path ?? 'Configured at runtime'}</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading live log entries...</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {tableReady ? (
        <DataTable
          tableId={tableId}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          emptyMessage={error ? 'Log feed unavailable.' : 'No log entries match the current filter.'}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          columnPickerEnabled={true}
        />
      ) : null}

      {selectedEntry ? (
        <StructuredView title="Log entry detail" value={selectedEntry.raw ?? selectedEntry} />
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
