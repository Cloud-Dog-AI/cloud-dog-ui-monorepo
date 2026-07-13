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

// @cloud-dog/app-sql-agent - Jobs panel (PS-76 v2 compliant).
// Covers: FR-54
// Standard: PS-76 (Job Control WebUI Standard) v2.0

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import {
  Badge,
  Button,
  CodeViewer,
  ConfirmDialog,
  DataTable,
  Dialog,
  Input,
  JsonBlock,
  MetricCard,
  RelativeTime,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BulkAction,
  type DataColumn,
} from '@cloud-dog/ui';
import {
  downloadTextFile,
  ErrorState,
  PageFrame,
  requestJson,
  safeStringify,
  type JobsListResponse,
} from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type JobRecord = Record<string, unknown>;

const STATUS_OPTIONS = [
  'created',
  'validated',
  'queued',
  'dispatched',
  'running',
  'retry_wait',
  'blocked',
  'paused',
  'succeeded',
  'failed',
  'cancelled',
  'timeout',
  'dead_lettered',
  'archived',
];

const CANCELLABLE_STATUSES = new Set(['created', 'validated', 'queued', 'dispatched', 'running', 'retry_wait', 'blocked', 'paused']);
const RETRYABLE_STATUSES = new Set(['failed', 'timeout', 'timed_out', 'dead_lettered']);
const TERMINAL_STATUSES = new Set(['succeeded', 'completed', 'failed', 'cancelled', 'timeout', 'timed_out', 'dead_lettered', 'archived']);
// Result downloads only make sense for jobs that produced a result.
const DOWNLOADABLE_STATUSES = new Set(['succeeded', 'completed']);
const NOT_STARTED_STATUSES = new Set(['created', 'validated', 'queued', 'scheduled', 'blocked']);

function str(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function parseDateMs(value: unknown): number {
  const text = str(value);
  if (!text) return 0;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

function lifecycleStatus(row: JobRecord): string {
  return str(row.native_status || row.lifecycle_status || row.status || 'unknown').toLowerCase();
}

function actorName(row: JobRecord): string {
  return str(row.actor || row.request_auth_identity || row.submitted_by || row.username || row.user_id || 'system');
}

function jobId(row: JobRecord): string {
  return str(row.job_id || row.id);
}

function jobType(row: JobRecord): string {
  const rawType = str(row.type || row.job_type || '').toLowerCase();
  const question = str(row.question).toLowerCase();
  if (rawType && !['sql_query', 'query_database'].includes(rawType)) return rawType;
  if (question.startsWith('rebuild context') || question.includes('context rebuild')) return 'context_rebuild';
  if (question.includes(' explain ') || question.startsWith('explain')) return 'explain';
  return 'query';
}

function retryCount(row: JobRecord): number {
  const explicit = Number(row.retry_count ?? row.retries ?? row.retry);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const attempt = Number(row.attempt ?? 1);
  return Number.isFinite(attempt) && attempt > 1 ? attempt - 1 : 0;
}

function timestampFor(row: JobRecord, key: 'created' | 'started' | 'updated' | 'completed'): string {
  if (key === 'created') return str(row.created_at || row.start_time);
  if (key === 'updated') return str(row.updated_at || row.last_heartbeat_at || row.completed_at || row.started_at || row.created_at);
  if (key === 'completed') return TERMINAL_STATUSES.has(lifecycleStatus(row)) ? str(row.completed_at || row.end_time) : '';

  const status = lifecycleStatus(row);
  if (NOT_STARTED_STATUSES.has(status)) return '';
  return str(row.started_at);
}

function formatDuration(row: JobRecord): string {
  let seconds = Number(row.elapsed_seconds ?? row.processing_time_seconds ?? row.duration);
  const started = parseDateMs(timestampFor(row, 'started'));
  const completed = parseDateMs(timestampFor(row, 'completed'));
  if ((!Number.isFinite(seconds) || seconds < 0) && started > 0) {
    const end = completed > 0 ? completed : Date.now();
    seconds = Math.max(0, (end - started) / 1000);
  }
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest ? `${minutes} min ${rest} sec` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours} hr ${rem} min` : `${hours} hr`;
}

function statusBadgeClass(status: string): string {
  if (status === 'succeeded') return 'text-white border-emerald-700';
  if (['failed', 'dead_lettered', 'timeout', 'timed_out'].includes(status)) return 'text-white border-red-800';
  if (['retry_wait', 'blocked', 'paused'].includes(status)) return 'text-amber-950 border-amber-500';
  if (status === 'cancelled') return 'text-slate-800 border-slate-400 line-through';
  return 'text-slate-800 border-slate-300';
}

function statusBadgeStyle(status: string): React.CSSProperties | undefined {
  if (status === 'succeeded') return { backgroundColor: 'rgb(4, 120, 87)' };
  if (['failed', 'dead_lettered', 'timeout', 'timed_out'].includes(status)) return { backgroundColor: 'rgb(185, 28, 28)' };
  if (['retry_wait', 'blocked', 'paused'].includes(status)) return { backgroundColor: 'rgb(254, 243, 199)' };
  if (status === 'cancelled') return { backgroundColor: 'rgb(229, 231, 235)' };
  return { backgroundColor: 'rgb(241, 245, 249)' };
}

function StatusBadge({ status }: { status: string }) {
  const destructive = ['failed', 'dead_lettered', 'timeout', 'timed_out'].includes(status);
  return (
    <Badge
      data-testid={`job-status-${status}`}
      data-status={status}
      variant={destructive ? 'destructive' : status === 'succeeded' ? 'default' : 'secondary'}
      className={statusBadgeClass(status)}
      style={statusBadgeStyle(status)}
    >
      {status}
    </Badge>
  );
}

async function fetchJobDetail(baseUrl: string, id: string): Promise<JobRecord> {
  const response = await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object'
      ? str((payload as Record<string, unknown>).detail || (payload as Record<string, unknown>).message || text)
      : str(payload || text);
    throw new Error(`${response.status} ${detail || response.statusText}`);
  }
  return (payload && typeof payload === 'object' ? payload : {}) as JobRecord;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function ToggleChip(props: { label: string; selected: boolean; onClick: () => void; testId?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={props.selected ? 'default' : 'secondary'}
      aria-pressed={props.selected}
      data-testid={props.testId}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}

export function JobsPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const auth = useAuth();
  const isAdmin = Boolean(
    auth.hasPermission('admin:full') ||
      auth.user?.roles?.some((role) => ['admin', 'system_admin'].includes(role)),
  );

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [jobIdSearch, setJobIdSearch] = React.useState('');
  const [statusFilters, setStatusFilters] = React.useState<Set<string>>(() => new Set());
  const [typeFilters, setTypeFilters] = React.useState<Set<string>>(() => new Set());
  const [actorFilters, setActorFilters] = React.useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [detailJob, setDetailJob] = React.useState<JobRecord | null>(null);
  const [detailTab, setDetailTab] = React.useState('overview');
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{ action: 'cancel' | 'retry' | 'delete'; ids: string[] } | null>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [urlJobChecked, setUrlJobChecked] = React.useState('');

  const [version, setVersion] = React.useState(0);
  const jobs = React.useMemo(
    () => ({ refresh: () => setVersion((value) => value + 1) }),
    [],
  );
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<JobRecord[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void requestJson<JobsListResponse>(cfg.API_BASE_URL, '/api/v1/jobs?limit=1000')
      .then((payload) => {
        if (cancelled) return;
        setRows((payload.jobs ?? []) as JobRecord[]);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cfg.API_BASE_URL, version]);

  const openDetail = React.useCallback(
    async (idOrRow: string | JobRecord) => {
      const id = typeof idOrRow === 'string' ? idOrRow : jobId(idOrRow);
      if (!id) return;
      setInlineError(null);
      try {
        const latest = await fetchJobDetail(cfg.API_BASE_URL, id);
        setDetailJob(latest);
        setDetailTab('overview');
      } catch (error) {
        setDetailJob(null);
        setInlineError(error instanceof Error ? error.message : String(error));
      }
    },
    [cfg.API_BASE_URL],
  );

  // PS-76 v2 / W28A #25-02: the job detail record exposes result downloads
  // (JSON / ASCII table / CSV / Markdown) via the same `/jobs/{id}/result?format=`
  // surface the Search page uses, so a completed job's answer is exportable from Jobs.
  const downloadJobResult = React.useCallback(
    async (format: 'json' | 'table' | 'csv' | 'markdown') => {
      if (!detailJob) return;
      const id = jobId(detailJob);
      if (!id) return;
      setInlineError(null);
      try {
        const payload = await requestJson<{ result?: string }>(
          cfg.API_BASE_URL,
          `/api/v1/jobs/${id}/result?format=${format}`,
        );
        const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : format === 'markdown' ? 'md' : 'txt';
        const mime =
          format === 'json'
            ? 'application/json;charset=utf-8'
            : format === 'csv'
              ? 'text/csv;charset=utf-8'
              : format === 'markdown'
                ? 'text/markdown;charset=utf-8'
                : 'text/plain;charset=utf-8';
        downloadTextFile(`sql-agent-${id}.${ext}`, payload.result ?? '', mime);
      } catch (error) {
        setInlineError(error instanceof Error ? error.message : String(error));
      }
    },
    [cfg.API_BASE_URL, detailJob],
  );

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('job_id') || params.get('jobId');
    if (!id || id === urlJobChecked) return;
    setUrlJobChecked(id);
    void openDetail(id);
    const bulkAction = params.get('bulk');
    if (bulkAction === 'cancel' || bulkAction === 'retry' || bulkAction === 'delete') {
      setPendingAction({ action: bulkAction, ids: [id] });
    }
  }, [openDetail, urlJobChecked]);

  const statusOptions = React.useMemo(
    () => unique([...STATUS_OPTIONS, ...rows.map(lifecycleStatus)]),
    [rows],
  );
  const typeOptions = React.useMemo(
    () => unique(rows.map(jobType)),
    [rows],
  );
  const actorOptions = React.useMemo(
    () => unique(rows.map(actorName)),
    [rows],
  );

  const filteredRows = React.useMemo(() => {
    const exactId = jobIdSearch.trim();
    const fromMs = dateFrom ? Date.parse(`${dateFrom}T00:00:00`) : 0;
    const toMs = dateTo ? Date.parse(`${dateTo}T23:59:59`) : 0;
    const filtered = rows.filter((row) => {
      if (exactId && jobId(row) !== exactId) return false;
      if (statusFilters.size && !statusFilters.has(lifecycleStatus(row))) return false;
      if (typeFilters.size && !typeFilters.has(jobType(row))) return false;
      if (isAdmin && actorFilters.size && !actorFilters.has(actorName(row))) return false;
      const createdMs = parseDateMs(timestampFor(row, 'created'));
      if (fromMs && createdMs < fromMs) return false;
      if (toMs && createdMs > toMs) return false;
      return true;
    });
    return filtered.sort((a, b) => parseDateMs(timestampFor(b, 'created')) - parseDateMs(timestampFor(a, 'created')));
  }, [actorFilters, dateFrom, dateTo, isAdmin, jobIdSearch, rows, statusFilters, typeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  React.useEffect(() => {
    setPage(1);
  }, [actorFilters, dateFrom, dateTo, jobIdSearch, statusFilters, typeFilters]);

  const metrics = React.useMemo(() => {
    let queued = 0;
    let active = 0;
    let failed24h = 0;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const row of rows) {
      const status = lifecycleStatus(row);
      if (['created', 'validated', 'queued'].includes(status)) queued += 1;
      if (['dispatched', 'running'].includes(status)) active += 1;
      if (['failed', 'timeout', 'dead_lettered'].includes(status) && parseDateMs(timestampFor(row, 'updated')) >= dayAgo) failed24h += 1;
    }
    return { total: rows.length, queued, active, failed24h };
  }, [rows]);

  const toggleSetValue = React.useCallback((setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const selectedRowsFor = React.useCallback(
    (ids: string[]) => rows.filter((row) => ids.includes(jobId(row))),
    [rows],
  );

  const validateBulkAction = React.useCallback(
    (action: 'cancel' | 'retry' | 'delete', ids: string[]): string | null => {
      if (action === 'delete' && !isAdmin) return '403 Forbidden: delete requires admin';
      const selectedRows = selectedRowsFor(ids);
      if (selectedRows.length !== ids.length) return null;
      if (action === 'cancel' && selectedRows.some((row) => !CANCELLABLE_STATUSES.has(lifecycleStatus(row)))) {
        return 'Bulk Cancel Selected only applies to non-terminal jobs.';
      }
      if (action === 'retry' && selectedRows.some((row) => !RETRYABLE_STATUSES.has(lifecycleStatus(row)))) {
        return 'Bulk Retry Selected only applies to failed, timeout, or dead_lettered jobs.';
      }
      if (action === 'delete' && selectedRows.some((row) => !TERMINAL_STATUSES.has(lifecycleStatus(row)))) {
        return 'Bulk Delete Selected only applies to terminal jobs.';
      }
      return null;
    },
    [isAdmin, selectedRowsFor],
  );

  const requestBulkAction = React.useCallback(
    (action: 'cancel' | 'retry' | 'delete', ids: string[]) => {
      setActionError(null);
      const validation = validateBulkAction(action, ids);
      if (validation) {
        setActionError(validation);
        return;
      }
      setPendingAction({ action, ids });
    },
    [validateBulkAction],
  );

  const performAction = React.useCallback(async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      for (const id of pendingAction.ids) {
        if (pendingAction.action === 'cancel') {
          await requestJson(cfg.API_BASE_URL, `/api/v1/jobs/${encodeURIComponent(id)}/stop`, { method: 'POST' });
        } else if (pendingAction.action === 'retry') {
          await requestJson(cfg.API_BASE_URL, `/api/v1/jobs/${encodeURIComponent(id)}/rerun`, { method: 'POST' });
        } else {
          await requestJson(cfg.API_BASE_URL, `/api/v1/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
      }
      setPendingAction(null);
      setDetailJob(null);
      jobs.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy(false);
    }
  }, [cfg.API_BASE_URL, jobs, pendingAction]);

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: 'Bulk Cancel Selected', action: 'cancel' },
      { label: 'Bulk Retry Selected', action: 'retry' },
      ...(isAdmin ? [{ label: 'Bulk Delete Selected', action: 'delete' }] : []),
    ],
    [isAdmin],
  );

  const columns: DataColumn<JobRecord>[] = React.useMemo(
    () => [
      {
        id: 'job_id',
        header: 'Job ID',
        cell: (row) => (
          <Button
            className="max-w-[10rem] truncate font-mono text-xs"
            onClick={() => { void openDetail(row); }}
            type="button"
            title={jobId(row)}
            variant="link"
          >
            {jobId(row)}
          </Button>
        ),
        sortable: true,
        sortValue: jobId,
      },
      {
        id: 'question',
        header: 'Question',
        cell: (row) => {
          const text = str(row.question);
          return <span className="block max-w-[22rem] truncate" title={text}>{text}</span>;
        },
        sortable: true,
        sortValue: (row) => str(row.question),
      },
      { id: 'type', header: 'Type', cell: (row) => jobType(row), sortable: true, sortValue: jobType },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={lifecycleStatus(row)} />,
        sortable: true,
        sortValue: lifecycleStatus,
      },
      {
        id: 'created_at',
        header: 'Created',
        cell: (row) => {
          const ts = timestampFor(row, 'created');
          return ts ? <RelativeTime timestamp={ts} /> : '';
        },
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, 'created')),
      },
      {
        id: 'started_at',
        header: 'Started',
        cell: (row) => {
          const ts = timestampFor(row, 'started');
          return ts ? <RelativeTime timestamp={ts} /> : '';
        },
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, 'started')),
      },
      {
        id: 'updated_at',
        header: 'Updated',
        cell: (row) => {
          const ts = timestampFor(row, 'updated');
          return ts ? <RelativeTime timestamp={ts} /> : '';
        },
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, 'updated')),
      },
      {
        id: 'completed_at',
        header: 'Completed',
        cell: (row) => {
          const ts = timestampFor(row, 'completed');
          return ts ? <RelativeTime timestamp={ts} /> : '';
        },
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, 'completed')),
      },
      { id: 'actor', header: 'Actor', cell: actorName, sortable: true, sortValue: actorName },
      { id: 'duration', header: 'Duration', cell: formatDuration, sortable: true, sortValue: (row) => Number(row.elapsed_seconds ?? row.processing_time_seconds ?? 0) },
      {
        id: 'result_link',
        header: 'Result link',
        cell: (row) => {
          const id = jobId(row);
          return id ? (
            <a className="text-primary underline-offset-4 hover:underline" href={`${cfg.API_BASE_URL}/api/v1/jobs/${encodeURIComponent(id)}/result?format=json`}>
              Result
            </a>
          ) : '';
        },
        sortable: true,
        sortValue: jobId,
      },
      {
        id: 'log_link',
        header: 'Log link',
        cell: (row) => {
          const id = jobId(row);
          return id ? <a className="text-primary underline-offset-4 hover:underline" href={`/audit-log?job_id=${encodeURIComponent(id)}`}>Logs</a> : '';
        },
        sortable: true,
        sortValue: jobId,
      },
      { id: 'retry_count', header: 'Retry count', cell: (row) => retryCount(row), sortable: true, sortValue: retryCount },
    ],
    [cfg.API_BASE_URL, openDetail],
  );

  const detailStatus = detailJob ? lifecycleStatus(detailJob) : '';
  const detailId = detailJob ? jobId(detailJob) : '';

  return (
    <PageFrame
      eyebrow="PS-76 v2"
      title="Jobs"
      description="Background query execution, lifecycle management, and result inspection."
      actions={
        <Button variant="outline" onClick={() => { jobs.refresh(); setPage(1); }} type="button">
          Refresh
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <MetricCard label="Total Jobs" value={metrics.total} />
        <MetricCard label="Queue Depth" value={metrics.queued} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Failed (24h)" value={metrics.failed24h} tone={metrics.failed24h > 0 ? 'warning' : 'default'} />
      </div>

      <div className="mb-4 space-y-3 rounded-md border border-border bg-background p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,20rem)_1fr]">
          <label className="text-sm font-medium">
            <span className="mb-1 block">Search Job ID</span>
            <Input
              placeholder="Exact Job ID"
              value={jobIdSearch}
              onChange={(event) => setJobIdSearch(event.target.value)}
              data-testid="jobs-search-job-id"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              <span className="mb-1 block">From</span>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block">To</span>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block">Page size</span>
              <Select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </Select>
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <ToggleChip
                key={status}
                label={status}
                selected={statusFilters.has(status)}
                onClick={() => toggleSetValue(setStatusFilters, status)}
                testId={`filter-status-${status}`}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
          <div className="flex flex-wrap gap-2">
            {(typeOptions.length ? typeOptions : ['query', 'context_rebuild', 'explain']).map((type) => (
              <ToggleChip
                key={type}
                label={type}
                selected={typeFilters.has(type)}
                onClick={() => toggleSetValue(setTypeFilters, type)}
                testId={`filter-type-${type}`}
              />
            ))}
          </div>
        </div>

        {isAdmin ? (
          <div data-testid="jobs-actor-filter">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actor</p>
            <div className="flex flex-wrap gap-2">
              {actorOptions.map((actor) => (
                <ToggleChip
                  key={actor}
                  label={actor}
                  selected={actorFilters.has(actor)}
                  onClick={() => toggleSetValue(setActorFilters, actor)}
                  testId={`filter-actor-${actor}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {inlineError ? <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inlineError}</div> : null}
      {actionError ? <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div> : null}
      {loadError ? <ErrorState message={loadError} /> : null}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span data-testid="jobs-total-records">Total Records: {filteredRows.length}</span>
        <span data-testid="jobs-page-count">Page {Math.min(page, totalPages)} of {totalPages}</span>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        emptyMessage={loading ? 'Loading jobs...' : 'No jobs found.'}
        getRowId={jobId}
        getSelectionLabel={(row) => `Select job ${jobId(row)}`}
        getRowName={(row) => `Job ${jobId(row)}`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        selectable
        selectionColumnPosition="start"
        columnPickerEnabled
        totalRows={filteredRows.length}
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          if (action === 'cancel' || action === 'retry' || action === 'delete') {
            requestBulkAction(action, selectedIds);
          }
        }}
        tableId="sql-agent-jobs-ps76-v2"
        ariaLabel="SQL agent jobs"
      />

      <Dialog open={detailJob !== null} onOpenChange={(open) => { if (!open) setDetailJob(null); }} label={detailId ? `Job ${detailId}` : 'Job detail'}>
        {detailJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Job {detailId}</h2>
                <p className="text-sm text-muted-foreground">{jobType(detailJob)} - {detailStatus}</p>
              </div>
              <StatusBadge status={detailStatus} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { void navigator.clipboard?.writeText(detailId); }}
              >
                Copy Job ID
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!RETRYABLE_STATUSES.has(detailStatus)}
                onClick={() => requestBulkAction('retry', [detailId])}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!CANCELLABLE_STATUSES.has(detailStatus)}
                onClick={() => requestBulkAction('cancel', [detailId])}
              >
                Cancel
              </Button>
              {isAdmin ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!TERMINAL_STATUSES.has(detailStatus)}
                  onClick={() => requestBulkAction('delete', [detailId])}
                >
                  Delete
                </Button>
              ) : null}
            </div>

            {/* W28A #25-02: result download affordances (JSON / ASCII / CSV / Markdown). */}
            <div className="flex flex-wrap gap-2" aria-label="Download job result">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="job-download-json"
                disabled={!DOWNLOADABLE_STATUSES.has(detailStatus)}
                onClick={() => void downloadJobResult('json')}
              >
                Download JSON
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="job-download-ascii"
                disabled={!DOWNLOADABLE_STATUSES.has(detailStatus)}
                onClick={() => void downloadJobResult('table')}
              >
                Download ASCII
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="job-download-csv"
                disabled={!DOWNLOADABLE_STATUSES.has(detailStatus)}
                onClick={() => void downloadJobResult('csv')}
              >
                Download CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="job-download-markdown"
                disabled={!DOWNLOADABLE_STATUSES.has(detailStatus)}
                onClick={() => void downloadJobResult('markdown')}
              >
                Download Markdown
              </Button>
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="parameters">Parameters</TabsTrigger>
                <TabsTrigger value="input_ref">Input ref</TabsTrigger>
                <TabsTrigger value="result_output">Result/Output</TabsTrigger>
                <TabsTrigger value="thinking">Thinking</TabsTrigger>
                <TabsTrigger value="lifecycle_log">Lifecycle log</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Job ID', detailId],
                    ['Type', jobType(detailJob)],
                    ['Status', detailStatus],
                    ['Actor', actorName(detailJob)],
                    ['Created', timestampFor(detailJob, 'created')],
                    ['Started', timestampFor(detailJob, 'started')],
                    ['Updated', timestampFor(detailJob, 'updated')],
                    ['Completed', timestampFor(detailJob, 'completed')],
                    ['Duration', formatDuration(detailJob)],
                    ['Retry count', String(retryCount(detailJob))],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words text-sm">{value || ''}</dd>
                    </div>
                  ))}
                </dl>
              </TabsContent>

              <TabsContent value="parameters">
                <JsonBlock
                  title="Parameters"
                  value={{
                    question: detailJob.question,
                    format_preference: detailJob.format_preference,
                    max_attempts: detailJob.max_attempts,
                    run_timeout_ms: detailJob.run_timeout_ms,
                    claim_timeout_ms: detailJob.claim_timeout_ms,
                    resources: detailJob.resources,
                  }}
                />
              </TabsContent>

              <TabsContent value="input_ref">
                <JsonBlock
                  title="Input ref"
                  value={{
                    request_id: detailJob.request_id,
                    correlation_id: detailJob.correlation_id,
                    trace_id: detailJob.trace_id,
                    request_source: detailJob.request_source,
                    request_ip: detailJob.request_ip,
                    request_user_agent: detailJob.request_user_agent,
                  }}
                />
              </TabsContent>

              <TabsContent value="result_output">
                {detailJob.sql_query ? <CodeViewer title="Generated SQL" language="sql" code={str(detailJob.sql_query)} /> : null}
                {detailJob.answer ? <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{str(detailJob.answer)}</pre> : null}
                {detailJob.error ? <JsonBlock title="Error" value={detailJob.error} /> : null}
                {!detailJob.answer && !detailJob.error ? <p className="text-sm text-muted-foreground">No result output recorded.</p> : null}
              </TabsContent>

              <TabsContent value="thinking">
                {detailJob.thinking ? (
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{str(detailJob.thinking)}</pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No thinking trace recorded.</p>
                )}
              </TabsContent>

              <TabsContent value="lifecycle_log">
                <JsonBlock title="Lifecycle log" value={detailJob.lifecycle_history || detailJob.progress || []} />
              </TabsContent>

              <TabsContent value="raw">
                <CodeViewer title="Raw job record" language="json" code={safeStringify(detailJob)} />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title={pendingAction ? `Confirm ${pendingAction.action}` : 'Confirm action'}
        description={pendingAction ? `${pendingAction.action} ${pendingAction.ids.length} selected job(s).` : ''}
        targetName={pendingAction?.ids.join(', ')}
        confirmLabel="Confirm"
        confirmVariant={pendingAction?.action === 'delete' ? 'destructive' : 'default'}
        irreversible={pendingAction?.action === 'delete'}
        loading={actionBusy}
        error={actionError}
        onConfirm={() => { void performAction(); }}
      />
    </PageFrame>
  );
}
