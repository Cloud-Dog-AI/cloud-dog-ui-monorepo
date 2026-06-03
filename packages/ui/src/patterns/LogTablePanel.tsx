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

// @cloud-dog/ui — PS-40 NIST AU-3 compliant log DataTable panel (shared pattern).
// Covers: UI-R11, UI-R25. Consolidated from chat-client, expert-agent, notification-agent.

import * as React from 'react';
import { Button } from '../components/button/Button';
import { Card, CardContent, CardHeader } from '../components/card/Card';
import { DataTable } from '../components/table/DataTable';
import { Input } from '../components/input/Input';
import { Select } from '../components/input/Select';
import { StructuredView } from './StructuredView';
import { RelativeTime } from './RelativeTime';
import type { DataColumn } from '../components/table/DataTable';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AuditLogEntry = {
  id: string;
  timestamp?: string | null;
  event_type?: string | null;
  action?: string | null;
  outcome?: string | null;
  severity?: string | null;
  level?: string | null;
  message?: string | null;
  trace_id?: string | null;
  request_id?: string | null;
  service?: string | null;
  service_instance?: string | null;
  environment?: string | null;
  surface: string;
  surface_label?: string | null;
  source_path?: string | null;
  logger?: string | null;
  actor?: {
    type?: string | null;
    id?: string | null;
    ip?: string | null;
    roles?: string[] | null;
    user_agent?: string | null;
  } | null;
  target?: {
    type?: string | null;
    id?: string | null;
    name?: string | null;
    path?: string | null;
  } | null;
  details?: Record<string, unknown> | null;
  raw?: unknown;
};

export type LogSurface = { id: string; label: string };

export type LogsResponse = {
  entries: AuditLogEntry[];
  available_surfaces?: LogSurface[];
  surface_label?: string | null;
  source_path?: string | null;
  count: number;
};

export type LogApiAdapter = {
  getLogs(params: { limit: number; surface: string; query?: string }): Promise<LogsResponse>;
};

export type LogTablePanelProps = Readonly<{
  api: LogApiAdapter;
  tableId: string;
  title: string;
  description: string;
  initialSurface?: string;
  limit?: number;
  embedded?: boolean;
  defaultVisibleColumns?: string[];
  refreshInterval?: number;
  followTailDefault?: boolean;
}>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LOG_SURFACES: LogSurface[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'api', label: 'API' },
  { id: 'web', label: 'Web' },
  { id: 'mcp', label: 'MCP' },
  { id: 'a2a', label: 'A2A' },
];

const DEFAULT_VISIBLE_COLUMNS = [
  'timestamp', 'who', 'action', 'target', 'outcome', 'severity',
  'traceId', 'service', 'message', 'inspect',
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatLocalTimestamp(value?: string | null): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatActor(value?: AuditLogEntry['actor'] | null): string {
  return `${value?.type ?? 'unknown'}:${value?.id ?? 'N/A'}`;
}

function formatTarget(value?: AuditLogEntry['target'] | null): string {
  return `${value?.type ?? 'unknown'}:${value?.id ?? 'N/A'}`;
}

function formatService(row: AuditLogEntry): string {
  return `${row.service ?? 'N/A'} / ${row.service_instance ?? 'N/A'}`;
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
    row.surface_label, row.message, row.logger, row.event_type,
    row.action, row.outcome, row.severity, row.trace_id,
    row.request_id, row.service, row.service_instance, row.environment,
    row.actor?.type, row.actor?.id, row.actor?.ip,
    row.actor?.roles?.join(' '), row.actor?.user_agent,
    row.target?.type, row.target?.id, row.target?.name,
    row.source_path, row.timestamp,
    row.details ? JSON.stringify(row.details) : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LogTablePanel(props: LogTablePanelProps) {
  const {
    api,
    tableId,
    title,
    description,
    initialSurface = 'audit',
    limit = 100,
    embedded = false,
    defaultVisibleColumns = DEFAULT_VISIBLE_COLUMNS,
    refreshInterval = 30_000,
    followTailDefault = true,
  } = props;

  const [surface, setSurface] = React.useState(initialSurface);
  const [payload, setPayload] = React.useState<LogsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(limit <= 10 ? limit : 25);
  const [query, setQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(query);
  const [followTail, setFollowTail] = React.useState(followTailDefault);
  const [lastRefreshAt, setLastRefreshAt] = React.useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = React.useState<AuditLogEntry | null>(null);
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());
  const [tableReady, setTableReady] = React.useState(typeof window === 'undefined');

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
      // Ignore localStorage failures.
    }
    setTableReady(true);
  }, [defaultVisibleColumns, tableId]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await api.getLogs({
        surface,
        limit,
        query: deferredQuery.trim() || undefined,
      });
      setPayload(next);
      setHiddenIds(new Set());
      setStatus(
        `Loaded ${next.count} ${next.surface_label ?? surface.toUpperCase()} entries from ${next.source_path ?? 'configured source'}.`
      );
      setLastRefreshAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [api, deferredQuery, limit, surface]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!followTail || refreshInterval <= 0) return;
    const timer = window.setInterval(() => { void refresh(); }, refreshInterval);
    return () => window.clearInterval(timer);
  }, [followTail, refresh, refreshInterval]);

  React.useEffect(() => {
    setPage(1);
    setSelectedEntry(null);
  }, [surface, deferredQuery]);

  const availableSurfaces = payload?.available_surfaces?.length
    ? payload.available_surfaces
    : DEFAULT_LOG_SURFACES;

  const rows = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return (payload?.entries ?? []).filter((row) => {
      if (hiddenIds.has(row.id)) return false;
      if (!needle) return true;
      return searchText(row).includes(needle);
    });
  }, [deferredQuery, hiddenIds, payload?.entries]);

  const handleBulkAction = React.useCallback((_action: string, selectedIds: string[]) => {
    if (_action !== 'delete' || !selectedIds.length) return;
    const selectedSet = new Set(selectedIds);
    setHiddenIds((previous) => {
      const next = new Set(previous);
      for (const id of selectedSet) next.add(id);
      return next;
    });
    setSelectedEntry((current) => (current && selectedSet.has(current.id) ? null : current));
    setStatus(`Removed ${selectedIds.length} selected rows from the current view. Refresh to reload from disk.`);
  }, []);

  const columns = React.useMemo<DataColumn<AuditLogEntry>[]>(() => [
    { id: 'who', header: 'Who', sortable: true, sortValue: (row) => `${row.actor?.type ?? ''}:${row.actor?.id ?? ''}`, cell: (row) => <span className="font-mono text-xs">{formatActor(row.actor)}</span> },
    { id: 'from', header: 'From', sortable: true, sortValue: (row) => row.actor?.ip ?? '', cell: (row) => <span className="font-mono text-xs">{row.actor?.ip ?? 'N/A'}</span> },
    { id: 'eventType', header: 'Event Type', sortable: true, sortValue: (row) => row.event_type ?? '', cell: (row) => row.event_type ?? 'N/A' },
    { id: 'action', header: 'Action', sortable: true, sortValue: (row) => row.action ?? '', cell: (row) => row.action ?? 'N/A' },
    { id: 'target', header: 'Target', sortable: true, sortValue: (row) => `${row.target?.type ?? ''}:${row.target?.id ?? ''}`, cell: (row) => <span className="font-mono text-xs">{formatTarget(row.target)}</span> },
    { id: 'outcome', header: 'Outcome', sortable: true, sortValue: (row) => row.outcome ?? '', cell: (row) => row.outcome ?? 'N/A' },
    { id: 'severity', header: 'Severity', sortable: true, sortValue: (row) => row.severity ?? row.level ?? '', cell: (row) => row.severity ?? row.level ?? 'N/A' },
    { id: 'timestamp', header: 'Timestamp', sortable: true, sortValue: (row) => row.timestamp ?? '', cell: (row) => <RelativeTime timestamp={row.timestamp ?? ''} className="font-mono text-xs" /> },
    { id: 'traceId', header: 'Trace ID', sortable: true, sortValue: (row) => row.trace_id ?? '', cell: (row) => <span className="font-mono text-xs break-all">{row.trace_id ?? 'N/A'}</span> },
    { id: 'requestId', header: 'Request ID', sortable: true, sortValue: (row) => row.request_id ?? '', cell: (row) => <span className="font-mono text-xs break-all">{row.request_id ?? 'N/A'}</span> },
    { id: 'service', header: 'Service', sortable: true, sortValue: (row) => `${row.service ?? ''}:${row.service_instance ?? ''}`, cell: (row) => <span className="font-mono text-xs">{formatService(row)}</span> },
    { id: 'actorRoles', header: 'Actor Roles', sortable: true, sortValue: (row) => row.actor?.roles?.join(',') ?? '', cell: (row) => row.actor?.roles?.length ? row.actor.roles.join(', ') : 'N/A' },
    { id: 'userAgent', header: 'User Agent', sortable: true, sortValue: (row) => row.actor?.user_agent ?? '', cell: (row) => <span className="font-mono text-xs break-all">{row.actor?.user_agent ?? 'N/A'}</span> },
    { id: 'targetName', header: 'Target Name', sortable: true, sortValue: (row) => row.target?.name ?? '', cell: (row) => row.target?.name ?? 'N/A' },
    { id: 'details', header: 'Details', sortable: true, sortValue: (row) => detailsSummary(row.details), cell: (row) => <span className="font-mono text-xs break-all">{detailsSummary(row.details)}</span> },
    { id: 'message', header: 'Message', sortable: true, sortValue: (row) => row.message ?? '', cell: (row) => <span className="font-mono text-xs break-all">{row.message ?? 'N/A'}</span> },
    { id: 'source', header: 'Source', sortable: true, sortValue: (row) => row.surface_label ?? row.surface, cell: (row) => row.surface_label ?? row.surface.toUpperCase() },
    { id: 'environment', header: 'Environment', sortable: true, sortValue: (row) => row.environment ?? '', cell: (row) => row.environment ?? 'N/A' },
    { id: 'inspect', header: 'Inspect', cell: (row) => <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedEntry(row)}>View</Button> },
  ], []);

  const refreshSeconds = Math.round(refreshInterval / 1000);

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Log source</span>
          <Select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Log source"
            value={surface}
            onChange={(event) => setSurface(event.target.value)}
          >
            {availableSurfaces.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
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
          />
        </label>

        <Button type="button" variant="secondary" onClick={() => void refresh()}>Refresh</Button>
        <Button type="button" variant={followTail ? 'secondary' : 'default'} onClick={() => setFollowTail((c) => !c)}>
          {followTail ? 'Pause tail' : 'Follow tail'}
        </Button>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Current source: {payload?.surface_label ?? availableSurfaces.find((item) => item.id === surface)?.label ?? surface.toUpperCase()}</p>
        <p>Path: {payload?.source_path ?? 'Configured at runtime'}</p>
        <p>Tail mode: {followTail ? `Following with ${refreshSeconds}s refresh` : 'Paused'}{lastRefreshAt ? ` \u00b7 last refresh ${formatLocalTimestamp(lastRefreshAt)}` : ''}</p>
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
          selectable={true}
          bulkActions={[{ label: 'Delete selected', action: 'delete' }]}
          onBulkAction={handleBulkAction}
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
