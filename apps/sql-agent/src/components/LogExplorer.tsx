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

import * as React from 'react';
import { Badge, Button, DataTable, Input, Select, type DataColumn } from '@cloud-dog/ui';
import { requestJson } from '../lib/sqlAgentApi';

export type LogSource = 'api' | 'audit' | 'web' | 'mcp' | 'a2a';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type LogPayload = {
  success?: boolean;
  error?: string;
  log_type?: string;
  log_file?: string;
  total_lines?: number;
  returned_lines?: number;
  logs?: string[] | string;
  content?: string;
};

type LogActor = {
  type: string;
  id: string;
  ip: string;
  roles: string[];
  user_agent: string;
};

type LogTarget = {
  type: string;
  id: string;
  name: string;
};

export type LogRow = {
  id: string;
  source: LogSource;
  timestamp_utc: string;
  timestamp_local: string;
  actor: LogActor;
  event_type: string;
  action: string;
  target: LogTarget;
  outcome: string;
  severity: string;
  trace_id: string;
  request_id: string;
  service: string;
  service_instance: string;
  environment: string;
  status_code: string;
  message: string;
  details: string;
};

export const LOG_SOURCE_OPTIONS: Array<{ value: LogSource; label: string }> = [
  { value: 'audit', label: 'Audit trail' },
  { value: 'api', label: 'API server' },
  { value: 'web', label: 'Web server' },
  { value: 'mcp', label: 'MCP server' },
  { value: 'a2a', label: 'A2A server' },
];

const DEFAULT_VISIBLE_COLUMNS = [
  'who',
  'from',
  'event_type',
  'action',
  'target',
  'outcome',
  'severity',
  'timestamp',
  'trace_id',
  'service',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function statusToOutcome(statusCode: string): string {
  const value = Number(statusCode);
  if (!Number.isFinite(value)) return '';
  if (value >= 200 && value < 400) return 'success';
  if (value === 401 || value === 403) return 'denied';
  if (value >= 400) return 'error';
  return '';
}

function toLocalTimestamp(value: string): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function parsePlainTextLogLine(source: LogSource, line: string, index: number): LogRow {
  const uvicorn = line.match(/^([A-Z]+):\s+([0-9a-fA-F:\.\-]+)(?::\d+)? - \"([A-Z]+)\s+([^ ]+)\s+HTTP\/[0-9.]+\"\s+(\d{3})/);
  if (uvicorn) {
    const severity = uvicorn[1];
    const ip = uvicorn[2];
    const action = uvicorn[3];
    const path = uvicorn[4];
    const statusCode = uvicorn[5];
    return {
      id: `${source}-plain-${index}`,
      source,
      timestamp_utc: '',
      timestamp_local: 'Unknown',
      actor: { type: 'system', id: '', ip, roles: [], user_agent: '' },
      event_type: 'http.request',
      action,
      target: { type: 'endpoint', id: path, name: '' },
      outcome: statusToOutcome(statusCode),
      severity,
      trace_id: '',
      request_id: '',
      service: source,
      service_instance: '',
      environment: '',
      status_code: statusCode,
      message: line,
      details: '',
    };
  }

  return {
    id: `${source}-plain-${index}`,
    source,
    timestamp_utc: '',
    timestamp_local: 'Unknown',
    actor: { type: 'system', id: '', ip: '', roles: [], user_agent: '' },
    event_type: 'log.line',
    action: 'write',
    target: { type: 'log', id: source, name: '' },
    outcome: '',
    severity: 'INFO',
    trace_id: '',
    request_id: '',
    service: source,
    service_instance: '',
    environment: '',
    status_code: '',
    message: line,
    details: '',
  };
}

function parseLogLine(source: LogSource, line: string, index: number): LogRow {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const extra = asRecord(parsed.extra) ?? {};
    const actorRecord = asRecord(parsed.actor) ?? {};
    const targetRecord = asRecord(parsed.target) ?? {};
    const statusCode = asString(parsed.status_code) || asString(extra.status_code);
    const actorId =
      asString(actorRecord.id) ||
      asString(extra.user) ||
      asString(extra.username) ||
      asString(parsed.user_id);
    const actorType = asString(actorRecord.type) || (actorId ? 'user' : 'system');
    const action =
      asString(parsed.action) ||
      asString(extra.action) ||
      asString(extra.method) ||
      asString(parsed.message) ||
      'write';
    const targetId =
      asString(targetRecord.id) ||
      asString(extra.path) ||
      asString(extra.endpoint) ||
      asString(extra.tool_name);
    const targetType =
      asString(targetRecord.type) ||
      (asString(extra.path) ? 'endpoint' : asString(extra.tool_name) ? 'tool' : 'log');
    const eventType =
      asString(parsed.event_type) ||
      asString(extra.event_type) ||
      (targetType === 'endpoint' ? 'http.request' : 'log.event');
    const timestampUtc = asString(parsed.timestamp) || asString(parsed.time);
    const severity = (asString(parsed.severity) || asString(parsed.level) || 'INFO').toUpperCase();
    const outcome = asString(parsed.outcome) || statusToOutcome(statusCode);

    return {
      id: `${source}-json-${index}-${timestampUtc || action || eventType}`,
      source,
      timestamp_utc: timestampUtc,
      timestamp_local: toLocalTimestamp(timestampUtc),
      actor: {
        type: actorType,
        id: actorId,
        ip: asString(actorRecord.ip) || asString(extra.client_ip) || asString(extra.ip),
        roles: asStringArray(actorRecord.roles),
        user_agent: asString(actorRecord.user_agent) || asString(extra.user_agent),
      },
      event_type: eventType,
      action,
      target: {
        type: targetType,
        id: targetId,
        name: asString(targetRecord.name),
      },
      outcome,
      severity,
      trace_id: asString(parsed.trace_id) || asString(parsed.correlation_id),
      request_id: asString(parsed.request_id) || asString(extra.request_id),
      service: asString(parsed.service) || source,
      service_instance: asString(parsed.service_instance),
      environment: asString(parsed.environment),
      status_code: statusCode,
      message: asString(parsed.message) || stringifyValue(parsed),
      details: stringifyValue(parsed.details || extra),
    };
  } catch {
    return parsePlainTextLogLine(source, line, index);
  }
}

function extractLogLines(payload: LogPayload): string[] {
  if (Array.isArray(payload.logs)) return payload.logs.map((line) => String(line));
  if (typeof payload.logs === 'string') return payload.logs.split('\n').filter(Boolean);
  if (typeof payload.content === 'string') return payload.content.split('\n').filter(Boolean);
  return [];
}

function ensureDefaultColumnVisibility(tableId: string): void {
  const storageKey = `dt.cols.${tableId}`;
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(storageKey) !== null) return;
  window.localStorage.setItem(storageKey, JSON.stringify(DEFAULT_VISIBLE_COLUMNS));
}

function searchableRow(row: LogRow): string {
  return [
    row.actor.type,
    row.actor.id,
    row.actor.ip,
    row.actor.roles.join(' '),
    row.actor.user_agent,
    row.event_type,
    row.action,
    row.target.type,
    row.target.id,
    row.target.name,
    row.outcome,
    row.severity,
    row.trace_id,
    row.request_id,
    row.service,
    row.service_instance,
    row.environment,
    row.message,
    row.details,
    row.status_code,
  ]
    .join(' ')
    .toLowerCase();
}

function toneForOutcome(outcome: string): 'default' | 'secondary' | 'destructive' {
  const value = outcome.toLowerCase();
  if (value === 'success') return 'secondary';
  if (value === 'error' || value === 'failure' || value === 'denied') return 'destructive';
  return 'default';
}

function toneForSeverity(severity: string): 'default' | 'secondary' | 'destructive' {
  const value = severity.toUpperCase();
  if (value === 'ERROR' || value === 'CRITICAL') return 'destructive';
  if (value === 'WARNING') return 'secondary';
  return 'default';
}

function getCorrelationToken(row: LogRow): string {
  return row.trace_id || row.request_id || '';
}

function buildColumns(onCorrelate: (token: string) => void): DataColumn<LogRow>[] {
  return [
    {
      id: 'who',
      header: 'Who',
      sortable: true,
      sortValue: (row) => `${row.actor.type}:${row.actor.id}`,
      cell: (row) => `${row.actor.type || 'unknown'}:${row.actor.id || 'unknown'}`,
    },
    {
      id: 'from',
      header: 'From',
      sortable: true,
      sortValue: (row) => row.actor.ip,
      cell: (row) => row.actor.ip || 'unknown',
    },
    {
      id: 'event_type',
      header: 'Event Type',
      sortable: true,
      sortValue: (row) => row.event_type,
      cell: (row) => row.event_type || '—',
    },
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (row) => row.action,
      cell: (row) => row.action || '—',
    },
    {
      id: 'target',
      header: 'Target',
      sortable: true,
      sortValue: (row) => `${row.target.type}:${row.target.id}`,
      cell: (row) => `${row.target.type || 'resource'}:${row.target.id || 'unknown'}`,
    },
    {
      id: 'outcome',
      header: 'Outcome',
      sortable: true,
      sortValue: (row) => row.outcome,
      cell: (row) => <Badge variant={toneForOutcome(row.outcome)}>{row.outcome || '—'}</Badge>,
    },
    {
      id: 'severity',
      header: 'Severity',
      sortable: true,
      sortValue: (row) => row.severity,
      cell: (row) => <Badge variant={toneForSeverity(row.severity)}>{row.severity || '—'}</Badge>,
    },
    {
      id: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      sortValue: (row) => row.timestamp_utc,
      cell: (row) => <time title={row.timestamp_utc || 'Unknown'}>{row.timestamp_local}</time>,
    },
    {
      id: 'trace_id',
      header: 'Trace / Request',
      sortable: true,
      sortValue: (row) => getCorrelationToken(row),
      cell: (row) => {
        const token = getCorrelationToken(row);
        if (!token) return '—';
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span>{token}</span>
            <Button onClick={() => onCorrelate(token)} type="button" variant="outline">
              Correlate
            </Button>
          </div>
        );
      },
    },
    {
      id: 'service',
      header: 'Service',
      sortable: true,
      sortValue: (row) => `${row.service}:${row.service_instance}`,
      cell: (row) => `${row.service || 'unknown'} / ${row.service_instance || 'unknown'}`,
    },
    {
      id: 'request_id',
      header: 'Request ID',
      sortable: true,
      sortValue: (row) => row.request_id,
      cell: (row) => row.request_id || '—',
    },
    {
      id: 'roles',
      header: 'Roles',
      sortable: true,
      sortValue: (row) => row.actor.roles.join(','),
      cell: (row) => row.actor.roles.join(', ') || '—',
    },
    {
      id: 'user_agent',
      header: 'User Agent',
      sortable: true,
      sortValue: (row) => row.actor.user_agent,
      cell: (row) => row.actor.user_agent || '—',
    },
    {
      id: 'target_name',
      header: 'Target Name',
      sortable: true,
      sortValue: (row) => row.target.name,
      cell: (row) => row.target.name || '—',
    },
    {
      id: 'status_code',
      header: 'Status',
      sortable: true,
      sortValue: (row) => row.status_code,
      cell: (row) => row.status_code || '—',
    },
    {
      id: 'environment',
      header: 'Environment',
      sortable: true,
      sortValue: (row) => row.environment,
      cell: (row) => row.environment || '—',
    },
    {
      id: 'message',
      header: 'Message',
      sortable: true,
      sortValue: (row) => row.message,
      cell: (row) => row.message || '—',
    },
    {
      id: 'details',
      header: 'Details',
      sortable: true,
      sortValue: (row) => row.details,
      cell: (row) => row.details || '—',
    },
  ];
}

export function LogExplorer(props: {
  apiBaseUrl: AppRuntimeConfig['API_BASE_URL'];
  defaultSource?: LogSource;
  defaultLines?: number;
  defaultPageSize?: number;
  tableId: string;
}) {
  const {
    apiBaseUrl,
    defaultSource = 'audit',
    defaultLines = 80,
    defaultPageSize = 10,
    tableId,
  } = props;
  const [source, setSource] = React.useState<LogSource>(defaultSource);
  const [payload, setPayload] = React.useState<LogPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);
  const [message, setMessage] = React.useState<string | null>(null);
  const [correlationToken, setCorrelationToken] = React.useState('');

  ensureDefaultColumnVisibility(tableId);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setError(null);
    requestJson<LogPayload>(apiBaseUrl, `/api/v1/logs?lines=${defaultLines}&type=${encodeURIComponent(source)}`)
      .then((next) => {
        if (next.success === false) {
          throw new Error(next.error || `Failed to load ${source} logs.`);
        }
        setPayload(next);
      })
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiBaseUrl, defaultLines, source]);

  React.useEffect(() => {
    setPage(1);
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [correlationToken]);

  const rows = React.useMemo(
    () => extractLogLines(payload ?? {}).map((line, index) => parseLogLine(source, line, index)).reverse(),
    [payload, source],
  );

  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (correlationToken && row.trace_id !== correlationToken && row.request_id !== correlationToken) return false;
      if (!term) return true;
      return searchableRow(row).includes(term);
    });
  }, [correlationToken, rows, search, source]);

  const columns = React.useMemo(() => buildColumns(setCorrelationToken), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Log source
            <Select
              aria-label="Log source"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={source}
              onChange={(event) => setSource(event.target.value as LogSource)}
            >
              {LOG_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Search logs
            <Input
              aria-label="Search logs"
              className="w-full min-w-[16rem]"
              placeholder="Search actor, action, target, trace ID, message..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <Button type="button" variant="outline" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-2 text-sm text-slate-600">
        <div>
          Showing <strong>{LOG_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source}</strong>
          {payload?.log_file ? ` from ${payload.log_file}` : ''}
        </div>
        {payload?.returned_lines != null ? (
          <div>
            Loaded {payload.returned_lines} of {payload.total_lines ?? payload.returned_lines} line(s).
          </div>
        ) : null}
        {source === 'audit' ? (
          <div>Audit rows are append-only on disk.</div>
        ) : null}
        {correlationToken ? (
          <div className="flex flex-wrap items-center gap-2 text-sky-700">
            <span>
              Correlation filter active for <strong>{correlationToken}</strong>.
            </span>
            <Button onClick={() => setCorrelationToken('')} type="button" variant="outline">
              Clear correlation
            </Button>
          </div>
        ) : null}
        {message ? <div className="text-sky-700">{message}</div> : null}
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading logs...</div> : null}
      {error ? <div className="text-sm text-rose-700">{error}</div> : null}
      {!loading && !error ? (
        <DataTable
          columnPickerEnabled
          columns={columns}
          emptyMessage={`No ${source} log rows matched the current filter.`}
          getRowId={(row) => row.id}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          page={page}
          pageSize={pageSize}
          rows={filteredRows}
          tableId={tableId}
          totalRows={filteredRows.length}
        />
      ) : null}
    </div>
  );
}
