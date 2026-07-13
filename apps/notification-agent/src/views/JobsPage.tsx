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

// @cloud-dog/app-notification-agent — PS-76 Jobs page for notification delivery control.
// Covers: FR1.32

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@cloud-dog/auth';
import {
  Badge,
  Button,
  DataTable,
  EntityDialog,
  Input,
  JsonBlock,
  MetricCard,
  RelativeTime,
  Select,
  formatSeconds,
  type BulkAction,
  type DataColumn,
} from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { JobQueueStatus, JobRecord } from '../lib/api';

const STATUS_CANCELLABLE = new Set([
  'created', 'validated', 'queued', 'scheduled', 'dispatched', 'running', 'blocked', 'paused', 'retry_wait',
]);
const STATUS_RETRYABLE = new Set(['failed', 'cancelled', 'timeout', 'timed_out', 'dead_lettered']);
const STATUS_DELETABLE = new Set(['succeeded', 'completed', 'failed', 'cancelled', 'timeout', 'timed_out', 'dead_lettered', 'ttl_expired']);
const TERMINAL_STATUSES = new Set(['succeeded', 'completed', 'failed', 'cancelled', 'timeout', 'timed_out', 'dead_lettered', 'ttl_expired', 'archived']);
const DETAIL_TABS = ['Overview', 'Parameters', 'Input ref', 'Result/Output', 'Thinking', 'Lifecycle log', 'Raw'] as const;
type DetailTab = typeof DETAIL_TABS[number];

function canTransition(status: string | null | undefined, supported: Set<string>): boolean {
  return supported.has(String(status ?? '').trim().toLowerCase());
}

function queueDepthFromStatus(status: JobQueueStatus): number {
  return ['created', 'validated', 'queued', 'scheduled', 'retry_wait']
    .reduce((sum, key) => sum + Number(status[key] ?? 0), 0);
}

function formatDuration(job: JobRecord): string {
  const started = job.started_at ? Date.parse(job.started_at) : NaN;
  const ended = job.finished_at ? Date.parse(job.finished_at) : job.updated_at ? Date.parse(job.updated_at) : NaN;
  if (Number.isNaN(started)) return 'Not started';
  if (Number.isNaN(ended) || ended < started) return 'In progress';
  // CX-170: shared formatSeconds helper, no bespoke duration concatenation.
  return formatSeconds(Math.round((ended - started) / 1000));
}

function formatStarted(job: JobRecord): React.ReactNode {
  if (job.started_at) return <RelativeTime timestamp={job.started_at} />;
  return '—';
}

function formatCompleted(job: JobRecord): React.ReactNode {
  const status = String(job.status ?? '').toLowerCase();
  if (job.finished_at) return <RelativeTime timestamp={job.finished_at} />;
  return TERMINAL_STATUSES.has(status) ? '—' : '—';
}

function truncate(value: string | number | null | undefined, max = 60): string {
  const text = `${value ?? ''}`.trim();
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function outcomeSummary(job: JobRecord): string {
  const summary = `${job.outcome_summary ?? ''}`.trim();
  if (summary) return summary;
  if (typeof job.last_error === 'string' && job.last_error.trim()) return job.last_error.trim();
  if (job.last_error && typeof job.last_error === 'object') {
    const record = job.last_error as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error', 'reason']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return '';
}

function jobStatusPresentation(status: string | null | undefined): { variant: 'default' | 'secondary' | 'destructive'; className?: string } {
  const value = String(status ?? 'unknown').trim().toLowerCase();
  if (value === 'succeeded' || value === 'completed') {
    return { variant: 'default', className: 'bg-emerald-600 border-emerald-700 text-white' };
  }
  if (value === 'blocked' || value === 'paused' || value === 'retry_wait') {
    return { variant: 'secondary', className: 'bg-amber-100 border-amber-200 text-amber-900' };
  }
  if (value === 'failed' || value === 'dead_lettered' || value === 'timeout' || value === 'timed_out') {
    return { variant: 'destructive', className: value === 'dead_lettered' ? 'font-semibold' : undefined };
  }
  if (value === 'ttl_expired') {
    return { variant: 'secondary', className: 'bg-red-50 border-red-200 text-red-700' };
  }
  if (value === 'cancelled') {
    return { variant: 'secondary', className: 'line-through opacity-80' };
  }
  if (value === 'archived') {
    return { variant: 'secondary', className: 'opacity-70' };
  }
  return { variant: 'secondary' };
}

function statusLabel(status: string | null | undefined): string {
  const value = String(status ?? 'unknown').trim().toLowerCase();
  return value
    .split('_')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ');
}

function actorLabel(job: JobRecord): string {
  const identity = String(job.request_auth_identity ?? '').trim();
  const userId = String(job.user_id ?? '').trim();
  if (identity && userId && identity !== userId) return `${identity} (${userId})`;
  if (identity) return identity;
  if (userId) return userId;
  return '—';
}

function jobActorIdentifiers(job: JobRecord): string[] {
  return [job.request_auth_identity, job.user_id, actorLabel(job)]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function dateInputValue(offsetHours: number): string {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
}

type ConfirmAction = Readonly<{
  action: 'cancel' | 'retry' | 'delete';
  jobIds: string[];
  label: string;
}>;

export function JobsPage() {
  const auth = useAuth();
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();

  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [queueStatus, setQueueStatus] = React.useState<JobQueueStatus>({});
  const [status, setStatus] = React.useState('Loading jobs…');
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<string[]>([]);
  const [actorFilter, setActorFilter] = React.useState<string[]>([]);
  const [dateFrom, setDateFrom] = React.useState(dateInputValue(-24));
  const [dateTo, setDateTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [activeJob, setActiveJob] = React.useState<JobRecord | null>(null);
  const [activeDetailTab, setActiveDetailTab] = React.useState<DetailTab>('Overview');
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null);

  React.useEffect(() => {
    if (!activeJob) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveJob(null);
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [activeJob]);

  const permissions = auth.user?.permissions ?? [];
  const roles = auth.user?.roles ?? [];
  const isAdmin = permissions.includes('*') || roles.includes('admin');
  const canReadJobs = isAdmin || permissions.includes('read_jobs') || permissions.includes('notification:list:read') || permissions.includes('notification:item:read');
  const canWriteJobs = isAdmin || permissions.includes('write_jobs') || permissions.includes('notification:send:execute') || permissions.includes('notification:item:delete');
  const viewerIdentifiers = React.useMemo(() => new Set(
    [auth.user?.id, auth.user?.username, auth.user?.displayName, auth.user?.email]
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean),
  ), [auth.user?.displayName, auth.user?.email, auth.user?.id, auth.user?.username]);

  const jobsById = React.useMemo(
    () => new Map(jobs.map((job) => [job.job_id, job])),
    [jobs],
  );

  const refresh = React.useCallback(async () => {
    clearFailure();
    if (!canReadJobs) {
      setJobs([]);
      setQueueStatus({});
      setStatus('Insufficient permissions to view jobs.');
      return;
    }
    setStatus('Refreshing jobs…');
    try {
      const [items, queue] = await Promise.all([api.listJobs(250), api.getJobQueueStatus()]);
      setJobs(items);
      setQueueStatus(queue);
      setStatus(`Loaded ${items.length} jobs.`);
    } catch (error) {
      setStatus('');
      captureFailure(error);
    }
  }, [api, canReadJobs, captureFailure, clearFailure]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!canReadJobs) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [canReadJobs, refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [actorFilter, dateFrom, dateTo, jobs.length, query, statusFilter, typeFilter]);

  const metrics = React.useMemo(() => {
    const now = Date.now();
    const failed24h = jobs.filter((job) => {
      const statusName = String(job.status ?? '').toLowerCase();
      if (statusName !== 'failed') return false;
      const createdAt = job.created_at ? Date.parse(job.created_at) : NaN;
      return !Number.isNaN(createdAt) && (now - createdAt) < 24 * 60 * 60 * 1000;
    }).length;
    const active = jobs.filter((job) => ['running', 'dispatched'].includes(String(job.status ?? '').toLowerCase())).length;
    return {
      total: jobs.length,
      queueDepth: queueDepthFromStatus(queueStatus),
      active,
      failed24h,
    };
  }, [jobs, queueStatus]);

  const filteredJobs = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTime = dateFrom ? Date.parse(`${dateFrom}T00:00:00`) : NaN;
    const toTime = dateTo ? Date.parse(`${dateTo}T23:59:59`) : NaN;
    return jobs.filter((job) => {
      const statusName = String(job.status ?? '').toLowerCase();
      const typeName = String(job.job_type ?? '').toLowerCase();
      const actorName = actorLabel(job).toLowerCase();
      const createdAt = job.created_at ? Date.parse(job.created_at) : NaN;
      if (!isAdmin && viewerIdentifiers.size && !jobActorIdentifiers(job).some((actor) => viewerIdentifiers.has(actor))) return false;
      if (statusFilter.length && !statusFilter.includes(statusName)) return false;
      if (typeFilter.length && !typeFilter.includes(typeName)) return false;
      if (isAdmin && actorFilter.length && !actorFilter.includes(actorName)) return false;
      if (!Number.isNaN(fromTime) && !Number.isNaN(createdAt) && createdAt < fromTime) return false;
      if (!Number.isNaN(toTime) && !Number.isNaN(createdAt) && createdAt > toTime) return false;
      if (q) {
        const jobId = String(job.job_id ?? '').toLowerCase();
        if (jobId !== q) return false;
      }
      return true;
    }).sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')));
  }, [actorFilter, dateFrom, dateTo, isAdmin, jobs, query, statusFilter, typeFilter, viewerIdentifiers]);

  const statusOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) values.add(String(job.status ?? '').toLowerCase());
    return Array.from(values).filter(Boolean).sort();
  }, [jobs]);

  const typeOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) values.add(String(job.job_type ?? '').toLowerCase());
    for (const jobType of ['notification_delivery', 'llm_translation', 'llm_formatting']) values.add(jobType);
    return Array.from(values).filter(Boolean).sort();
  }, [jobs]);

  const actorOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) values.add(actorLabel(job).toLowerCase());
    return Array.from(values).filter(Boolean).sort();
  }, [jobs]);

  const [deliveryError, setDeliveryError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async (job: JobRecord, initialTab: DetailTab = 'Overview') => {
    setActiveJob(job);
    setActiveDetailTab(initialTab);
    setDeliveryError(null);
    try {
      const fresh = await api.getJob(job.job_id);
      setActiveJob(fresh);
      // NOTIFWEB-090: fetch delivery error when job has delivery_id in payload
      const deliveryId = (fresh.payload as Record<string, unknown>)?.delivery_id;
      if (deliveryId && !fresh.last_error) {
        try {
          const deliveries = await api.listDeliveries();
          const match = deliveries.find((d) => d.id === Number(deliveryId));
          if (match?.error) setDeliveryError(match.error);
          else if ((match as Record<string, unknown>)?.last_error) setDeliveryError(String((match as Record<string, unknown>).last_error));
        } catch { /* best effort */ }
      }
    } catch {
      // Keep the row snapshot open if the detail refresh fails.
    }
  }, [api]);

  const compatibleJobIds = React.useCallback((action: ConfirmAction['action'], ids: string[]): string[] => {
    return ids.filter((id) => {
      const job = jobsById.get(id);
      if (!job) return false;
      if (action === 'cancel') return canTransition(job.status, STATUS_CANCELLABLE);
      if (action === 'retry') return canTransition(job.status, STATUS_RETRYABLE);
      return canTransition(job.status, STATUS_DELETABLE);
    });
  }, [jobsById]);

  const requestAction = React.useCallback((action: ConfirmAction['action'], ids: string[]) => {
    const allowedIds = compatibleJobIds(action, ids);
    if (!allowedIds.length) {
      setStatus(`No selected jobs support ${action}.`);
      return;
    }
    const labels: Record<ConfirmAction['action'], string> = {
      cancel: `Cancel ${allowedIds.length} jobs?`,
      retry: `Retry ${allowedIds.length} jobs?`,
      delete: `Delete ${allowedIds.length} jobs? This cannot be undone.`,
    };
    setConfirmAction({ action, jobIds: allowedIds, label: labels[action] });
  }, [compatibleJobIds]);

  const performAction = React.useCallback(async (action: ConfirmAction['action'], jobIds: string[]) => {
    clearFailure();
    setStatus(`${action[0].toUpperCase()}${action.slice(1)} ${jobIds.length} job(s)…`);
    try {
      for (const jobId of jobIds) {
        if (action === 'cancel') {
          await api.cancelJob(jobId);
        } else if (action === 'retry') {
          await api.retryJob(jobId);
        } else {
          await api.deleteJob(jobId);
        }
      }
      setConfirmAction(null);
      await refresh();
      setStatus(`${action[0].toUpperCase()}${action.slice(1)} complete for ${jobIds.length} job(s).`);
    } catch (error) {
      setConfirmAction(null);
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const bulkActions = React.useMemo<BulkAction[]>(() => {
    const items: BulkAction[] = [];
    if (canWriteJobs) {
      items.push({ label: 'Cancel Selected', action: 'cancel' });
      items.push({ label: 'Retry Selected', action: 'retry' });
    }
    if (isAdmin) {
      items.push({ label: 'Delete Selected', action: 'delete' });
    }
    return items;
  }, [canWriteJobs, isAdmin]);

  const columns = React.useMemo<DataColumn<JobRecord>[]>(() => [
    {
      id: 'job_id',
      header: 'Job ID',
      sortable: true,
      sortValue: (job) => job.job_id,
      cell: (job) => (
        <div className="flex items-center gap-2">
          {/* CX-103: first identifier column exposes role="link" via react-router-dom Link. */}
          <Link
            to={`/jobs?jobId=${encodeURIComponent(job.job_id)}`}
            className="max-w-[11rem] truncate font-mono text-xs text-primary underline-offset-4 hover:underline"
            title={job.job_id}
            aria-label={`View job ${job.job_id}`}
            onClick={(e) => { e.preventDefault(); void loadDetail(job); }}
          >
            {job.job_id}
          </Link>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Copy job ID ${job.job_id}`}
            onClick={() => {
              void navigator.clipboard?.writeText(job.job_id);
              setStatus(`Copied ${job.job_id}.`);
            }}
          >
            Copy
          </Button>
        </div>
      ),
    },
    {
      id: 'job_type',
      header: 'Type',
      sortable: true,
      sortValue: (job) => job.job_type,
      cell: (job) => job.job_type,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (job) => String(job.status ?? ''),
      cell: (job) => {
        const presentation = jobStatusPresentation(job.status);
        return (
          <Badge variant={presentation.variant} className={presentation.className} data-status={String(job.status ?? 'unknown').toLowerCase()}>
            {statusLabel(job.status)}
          </Badge>
        );
      },
    },
    {
      id: 'created_at',
      header: 'Created',
      sortable: true,
      sortValue: (job) => String(job.created_at ?? ''),
      cell: (job) => job.created_at ? <RelativeTime timestamp={job.created_at} /> : '—',
    },
    {
      id: 'started_at',
      header: 'Started',
      sortable: true,
      sortValue: (job) => String(job.started_at ?? ''),
      cell: (job) => formatStarted(job),
    },
    {
      id: 'updated_at',
      header: 'Updated',
      sortable: true,
      sortValue: (job) => String(job.updated_at ?? ''),
      cell: (job) => job.updated_at ? <RelativeTime timestamp={job.updated_at} /> : '—',
    },
    {
      id: 'completed_at',
      header: 'Completed',
      sortable: true,
      sortValue: (job) => String(job.finished_at ?? ''),
      cell: (job) => formatCompleted(job),
    },
    {
      id: 'actor',
      header: 'Actor',
      sortable: true,
      sortValue: (job) => actorLabel(job),
      cell: (job) => truncate(actorLabel(job), 40),
    },
    {
      id: 'duration',
      header: 'Duration',
      sortable: true,
      sortValue: (job) => formatDuration(job),
      cell: (job) => formatDuration(job),
    },
    {
      id: 'result_link',
      header: 'Result link',
      sortable: true,
      sortValue: (job) => String(job.result_ref ?? outcomeSummary(job) ?? ''),
      cell: (job) => (
        <Button type="button" variant="link" className="p-0 text-xs text-sky-700 hover:underline" onClick={() => { void loadDetail(job, 'Result/Output'); }}>
          Result
        </Button>
      ),
    },
    {
      id: 'log_link',
      header: 'Log link',
      sortable: true,
      sortValue: (job) => String(job.correlation_id ?? job.job_id),
      cell: (job) => (
        <Button
          type="button"
          variant="link"
          className="p-0 text-xs text-sky-700 hover:underline"
          onClick={() => { window.location.href = `/monitoring?query=correlation_id:${encodeURIComponent(job.correlation_id ?? job.job_id)}`; }}
        >
          Log
        </Button>
      ),
    },
    {
      id: 'retry_count',
      header: 'Retry count',
      sortable: true,
      sortValue: (job) => Number(job.attempt ?? 0),
      cell: (job) => `${Number(job.attempt ?? 0) || 0}`,
    },
    {
      id: 'actions',
      header: '',
      cell: (job) => {
        const canCancel = canWriteJobs && canTransition(job.status, STATUS_CANCELLABLE);
        const canRetry = canWriteJobs && canTransition(job.status, STATUS_RETRYABLE);
        const canDelete = isAdmin && canTransition(job.status, STATUS_DELETABLE);
        return (
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => { void loadDetail(job); }}>
              Detail
            </Button>
            {/* CX-104: per-row Log action links to /diagnostics-audit?actor=<job_id>. */}
            <Link to={`/diagnostics-audit?actor=${encodeURIComponent(job.job_id)}`}>
              <Button type="button" size="sm" variant="ghost">
                Log
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!canCancel}
              title={!canWriteJobs ? 'Insufficient permissions' : canCancel ? 'Cancel job' : 'Job cannot be cancelled in its current state'}
              onClick={() => requestAction('cancel', [job.job_id])}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!canRetry}
              title={!canWriteJobs ? 'Insufficient permissions' : canRetry ? 'Retry job' : 'Job cannot be retried in its current state'}
              onClick={() => requestAction('retry', [job.job_id])}
            >
              Retry
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canDelete}
                title={canDelete ? 'Delete job' : 'Job must be terminal before delete'}
                onClick={() => requestAction('delete', [job.job_id])}
              >
                Delete
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ], [canWriteJobs, isAdmin, loadDetail, requestAction]);

  const detailBody = activeJob ? (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Job detail tabs">
          {DETAIL_TABS.map((tab) => (
            <Button
              key={tab}
              type="button"
              size="sm"
              variant={activeDetailTab === tab ? 'default' : 'secondary'}
              role="tab"
              aria-selected={activeDetailTab === tab}
              onClick={() => setActiveDetailTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(activeJob.job_id);
              setStatus(`Copied ${activeJob.job_id}.`);
            }}
          >
            Copy Job ID
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canWriteJobs || !canTransition(activeJob.status, STATUS_RETRYABLE)}
            onClick={() => requestAction('retry', [activeJob.job_id])}
          >
            Retry
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canWriteJobs || !canTransition(activeJob.status, STATUS_CANCELLABLE)}
            onClick={() => requestAction('cancel', [activeJob.job_id])}
          >
            Cancel
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!canTransition(activeJob.status, STATUS_DELETABLE)}
              onClick={() => requestAction('delete', [activeJob.job_id])}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 rounded-lg border p-4 text-sm" data-testid="job-result-summary">
        <h2 className="mb-2 font-semibold">Result summary</h2>
        <p><span className="font-medium">Channel:</span> {activeJob.channel_name ?? 'N/A'}</p>
        <p><span className="font-medium">Destination:</span> {activeJob.destination ?? 'N/A'}</p>
        {activeJob.message_id ? (
          <p>
            <span className="font-medium">Message:</span>{' '}
            <Link className="text-sky-700 underline" to={`/messages?highlight=${activeJob.message_id}`}>
              #{activeJob.message_id}
            </Link>
          </p>
        ) : null}
        <p><span className="font-medium">Outcome:</span> {outcomeSummary(activeJob) || String(activeJob.status ?? 'N/A')}</p>
      </div>

      {activeDetailTab === 'Overview' ? (
        <div role="tabpanel" className="grid gap-3 sm:grid-cols-2">
          {([
            ['Job ID', activeJob.job_id],
            ['Type', activeJob.job_type],
            ['Status', statusLabel(activeJob.status)],
            ['Actor', actorLabel(activeJob)],
            ['Created', activeJob.created_at ?? '—'],
            ['Started', activeJob.started_at ?? '—'],
            ['Updated', activeJob.updated_at ?? '—'],
            ['Completed', activeJob.finished_at ?? '—'],
            ['Duration', formatDuration(activeJob)],
            ['Retry count', String(Number(activeJob.attempt ?? 0) || 0)],
            ['Last error', outcomeSummary(activeJob) || '—'],
            ['Correlation ID', activeJob.correlation_id ?? '—'],
            ['Trace ID', (activeJob.payload as Record<string, unknown>)?.trace_id ?? '—'],
          ] as Array<[string, unknown]>).map(([label, value]) => (
            <div key={label} className={label === 'Last error' ? 'sm:col-span-2' : undefined}>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm">{String(value ?? '—')}</dd>
            </div>
          ))}
        </div>
      ) : null}

      {activeDetailTab === 'Parameters' ? (
        <div role="tabpanel">
          <JsonBlock title="Parameters" value={activeJob.payload ?? {}} defaultCollapsed={false} />
        </div>
      ) : null}

      {activeDetailTab === 'Input ref' ? (
        <div role="tabpanel">
          <JsonBlock
            title="Input ref"
            value={{
              message_id: activeJob.message_id ?? null,
              channel_name: activeJob.channel_name ?? null,
              destination: activeJob.destination ?? null,
              request_source: activeJob.request_source ?? null,
              request_auth_method: activeJob.request_auth_method ?? null,
            }}
            defaultCollapsed={false}
          />
        </div>
      ) : null}

      {activeDetailTab === 'Result/Output' ? (
        <div role="tabpanel" className="space-y-3">
          <JsonBlock
            title="Result/Output"
            value={{
              outcome: outcomeSummary(activeJob) || String(activeJob.status ?? 'pending'),
              result_ref: activeJob.result_ref ?? null,
              delivery_error: deliveryError ?? null,
              last_error: activeJob.last_error ?? null,
            }}
            defaultCollapsed={false}
          />
          {deliveryError ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{deliveryError}</p>
          ) : null}
        </div>
      ) : null}

      {activeDetailTab === 'Thinking' ? (
        <div role="tabpanel">
          <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            No agent thinking trace is recorded for notification delivery jobs.
          </p>
        </div>
      ) : null}

      {activeDetailTab === 'Lifecycle log' ? (
        <div role="tabpanel">
          <JsonBlock
            title="Lifecycle log"
            value={[
              { timestamp: activeJob.created_at, from_state: null, to_state: 'created', actor: actorLabel(activeJob), message: 'Job record created', correlation_id: activeJob.correlation_id },
              { timestamp: activeJob.started_at, from_state: 'queued', to_state: 'running', actor: actorLabel(activeJob), message: 'Job dispatch started', correlation_id: activeJob.correlation_id },
              { timestamp: activeJob.updated_at, from_state: null, to_state: activeJob.status, actor: actorLabel(activeJob), message: 'Latest state update', correlation_id: activeJob.correlation_id },
              { timestamp: activeJob.finished_at, from_state: 'running', to_state: activeJob.status, actor: actorLabel(activeJob), message: 'Terminal state recorded', correlation_id: activeJob.correlation_id },
            ].filter((entry) => entry.timestamp)}
            defaultCollapsed={false}
          />
        </div>
      ) : null}

      {activeDetailTab === 'Raw' ? (
        <div role="tabpanel">
          <JsonBlock title="Raw" value={activeJob} defaultCollapsed={false} />
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Shared jobs surface for queue visibility, lifecycle control, and result inspection. Each job ID links to payload and correlation details.
        </p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      {!canReadJobs ? <p role="alert" className="text-sm text-destructive">Insufficient permissions to view jobs.</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Jobs" value={metrics.total} />
        <MetricCard label="Queue Depth" value={metrics.queueDepth} />
        <MetricCard label="Active Jobs" value={metrics.active} />
        <MetricCard label="Failed (24h)" value={metrics.failed24h} />
      </div>

      <div className="space-y-3 rounded-md border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Search</span>
            <Input
              placeholder="Search by Job ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Status</span>
            <Select
              multiple
              value={statusFilter}
              onChange={(e) => setStatusFilter(selectedValues(e.currentTarget))}
              className="min-h-24"
              aria-label="Status filter"
            >
              {statusOptions.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Type</span>
            <Select
              multiple
              value={typeFilter}
              onChange={(e) => setTypeFilter(selectedValues(e.currentTarget))}
              className="min-h-24"
              aria-label="Type filter"
            >
              {typeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </label>
          {isAdmin ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Actor</span>
              <Select
                multiple
                value={actorFilter}
                onChange={(e) => setActorFilter(selectedValues(e.currentTarget))}
                className="min-h-24"
                aria-label="Actor filter"
              >
                {actorOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </label>
          ) : null}
          <div className="grid gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Date range from</span>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Date range to</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Total Records: {filteredJobs.length} - Page {page} of {Math.max(1, Math.ceil(filteredJobs.length / pageSize))}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => { void refresh(); }}>
              Refresh jobs
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setStatus(`Runtime status: ${jobs.length} jobs loaded, ${filteredJobs.length} visible.`); }}>
              Refresh runtime status
            </Button>
          </div>
        </div>
      </div>

      {canReadJobs ? (
        <DataTable
          columns={columns}
          rows={filteredJobs}
          totalRows={filteredJobs.length}
          emptyMessage="No jobs returned."
          getRowId={(job) => job.job_id}
          ariaLabel="Notification agent jobs"
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          selectable
          selectionColumnPosition="start"
          bulkActions={bulkActions}
          onBulkAction={(action, selectedIds) => {
            requestAction(action as ConfirmAction['action'], selectedIds);
          }}
          columnPickerEnabled
          tableId="notification-agent-jobs"
        />
      ) : null}

      <EntityDialog
        open={activeJob !== null}
        onOpenChange={(open) => { if (!open) setActiveJob(null); }}
        title={activeJob ? `Job ID ${activeJob.job_id.slice(0, 12)}` : 'Job detail'}
        body={detailBody}
      />

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{confirmAction.label}</h2>
            <p className="text-sm text-muted-foreground">
              This action will be audit logged and applied to {confirmAction.jobIds.length} job(s).
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmAction.action === 'delete' ? 'destructive' : 'default'}
                onClick={() => { void performAction(confirmAction.action, confirmAction.jobIds); }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
