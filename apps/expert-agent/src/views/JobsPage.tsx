import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import {
  Badge,
  Button,
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
import { useExpertAgentState } from '../state/AppState';
import type { JobRecord, QueueStatus } from '../lib/api';
import { LoadingNote, PageScaffold, formatCount } from './shared';

const CANCELLABLE = new Set([
  'created',
  'validated',
  'queued',
  'scheduled',
  'dispatched',
  'running',
  'processing',
  'blocked',
  'paused',
  'pending',
  'retry_wait',
]);
const RETRYABLE = new Set(['failed', 'timed_out', 'timeout', 'dead_lettered', 'cancelled']);
const TERMINAL = new Set(['completed', 'succeeded', 'failed', 'cancelled', 'timed_out', 'timeout', 'dead_lettered', 'ttl_expired', 'archived']);
const SUCCESS_STATUSES = new Set(['succeeded']);
const ERROR_STATUSES = new Set(['failed', 'dead_lettered', 'timeout', 'timed_out']);
const WARNING_STATUSES = new Set(['retry_wait', 'blocked', 'paused']);
const NEUTRAL_STATUSES = new Set(['created', 'validated', 'queued', 'dispatched', 'running', 'cancelled', 'archived', 'scheduled', 'pending', 'processing']);

type PendingAction = Readonly<{
  action: 'cancel' | 'retry' | 'delete';
  jobIds: string[];
  label: string;
}>;

type DetailTab = 'overview' | 'parameters' | 'input' | 'result' | 'thinking' | 'lifecycle' | 'raw';

function normaliseStatus(status?: string | null): string {
  return String(status ?? 'unknown').trim().toLowerCase();
}

function jobId(job: JobRecord): string {
  return String(job.job_id ?? job.id);
}

function actorLabel(job: JobRecord): string {
  return String(job.actor ?? job.request_auth_identity ?? job.user_id ?? 'unknown');
}

function jobType(job: JobRecord): string {
  return String(job.job_type ?? job.type ?? 'unknown');
}

function asDateValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function timestampSortValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function truncate(value: unknown, max = 64): string {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function formatDuration(job: JobRecord): string {
  const value = Number(job.duration_seconds ?? Number.NaN);
  if (Number.isNaN(value) || value < 0) return '-';
  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  if (seconds <= 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`;
}

function retryCount(job: JobRecord): number {
  const metadataRetry = Number(job.metadata?.retry_count ?? Number.NaN);
  if (!Number.isNaN(metadataRetry) && metadataRetry >= 0) return Math.floor(metadataRetry);
  const attempt = Number(job.attempt ?? 1);
  if (!Number.isNaN(attempt) && attempt > 1) return Math.floor(attempt - 1);
  return 0;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function canCancel(job: JobRecord): boolean {
  return CANCELLABLE.has(normaliseStatus(job.status));
}

function canRetry(job: JobRecord): boolean {
  return RETRYABLE.has(normaliseStatus(job.status));
}

function canDelete(job: JobRecord): boolean {
  return TERMINAL.has(normaliseStatus(job.status));
}

function statusClass(status: string): string {
  const value = normaliseStatus(status);
  if (SUCCESS_STATUSES.has(value)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (ERROR_STATUSES.has(value)) return 'bg-red-100 text-red-800 border-red-200';
  if (WARNING_STATUSES.has(value)) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (NEUTRAL_STATUSES.has(value)) return 'bg-secondary text-secondary-foreground border-secondary/20';
  return 'bg-secondary text-secondary-foreground border-secondary/20';
}

function JobStatusBadge({ status }: { status?: string | null }) {
  const value = normaliseStatus(status);
  return (
    <Badge
      variant="secondary"
      className={statusClass(value)}
      role="status"
      aria-label={`Status: ${value}`}
      data-status={value}
    >
      {value}
    </Badge>
  );
}

function DateCell({ value }: { value?: string | null }) {
  return value ? <RelativeTime timestamp={value} /> : <span aria-label="blank">-</span>;
}

function dateInRange(job: JobRecord, startDate: string, endDate: string): boolean {
  const created = asDateValue(job.created_at);
  if (!created) return false;
  if (startDate && created < startDate) return false;
  if (endDate && created > endDate) return false;
  return true;
}

function selectedOptions(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
}

export function JobsPage() {
  const auth = useAuth();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [queue, setQueue] = React.useState<QueueStatus | null>(null);
  const [selectedJob, setSelectedJob] = React.useState<JobRecord | null>(null);
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [jobIdQuery, setJobIdQuery] = React.useState('');
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
  const [typeFilters, setTypeFilters] = React.useState<string[]>([]);
  const [actorFilters, setActorFilters] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const deepLinkLoaded = React.useRef<string | null>(null);

  const permissions = React.useMemo(() => new Set(auth.user?.permissions ?? []), [auth.user?.permissions]);
  const roles = React.useMemo(() => new Set(auth.user?.roles ?? []), [auth.user?.roles]);
  const isAdmin = roles.has('admin') || permissions.has('admin') || permissions.has('*');
  const canReadJobs = Boolean(auth.user) || isAdmin || permissions.has('read_jobs') || permissions.has('expert:read');
  const canMutateJobs = Boolean(auth.user);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [jobRecords, queueStatus] = await Promise.all([api.listJobs(), api.getQueueStatus()]);
      const createdDesc = [...jobRecords].sort((left, right) => {
        const byCreated = timestampSortValue(right.created_at).localeCompare(timestampSortValue(left.created_at));
        if (byCreated !== 0) return byCreated;
        return Number(right.job_id ?? right.id ?? 0) - Number(left.job_id ?? left.id ?? 0);
      });
      setJobs(createdDesc);
      setQueue(queueStatus);
      setSelectedJob((current) => {
        if (!current) return current;
        return createdDesc.find((job) => jobId(job) === jobId(current)) ?? current;
      });
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [jobIdQuery, statusFilters, typeFilters, actorFilters, startDate, endDate, jobs.length]);

  React.useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('job');
    if (!target || deepLinkLoaded.current === target) return;
    deepLinkLoaded.current = target;
    clearFailure();
    void api.getJob(Number(target))
      .then((job) => {
        setSelectedJob(job);
        setActiveTab('overview');
        setStatus(`Loaded job ${target}.`);
      })
      .catch((error) => {
        captureFailure(error);
        setStatus(`Job ${target} could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
      });
  }, [api, captureFailure, clearFailure]);

  const statusOptions = React.useMemo(() => {
    return Array.from(new Set(jobs.map((job) => normaliseStatus(job.status)).filter(Boolean))).sort();
  }, [jobs]);

  const typeOptions = React.useMemo(() => {
    return Array.from(new Set(jobs.map((job) => jobType(job)).filter(Boolean))).sort();
  }, [jobs]);

  const actorOptions = React.useMemo(() => {
    return Array.from(new Set(jobs.map((job) => actorLabel(job)).filter(Boolean))).sort();
  }, [jobs]);

  const filteredJobs = React.useMemo(() => {
    const exactId = jobIdQuery.trim();
    return jobs.filter((job) => {
      if (exactId && jobId(job) !== exactId) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(normaliseStatus(job.status))) return false;
      if (typeFilters.length > 0 && !typeFilters.includes(jobType(job))) return false;
      if (actorFilters.length > 0 && !actorFilters.includes(actorLabel(job))) return false;
      if ((startDate || endDate) && !dateInRange(job, startDate, endDate)) return false;
      return true;
    });
  }, [actorFilters, endDate, jobIdQuery, jobs, startDate, statusFilters, typeFilters]);

  const metrics = React.useMemo(() => {
    const statusCounts = queue?.status_counts ?? {};
    const queuedStatuses = ['created', 'validated', 'queued', 'pending', 'scheduled', 'retry_wait'];
    const activeStatuses = ['running', 'processing', 'dispatched'];
    return {
      total: jobs.length,
      queueDepth: Number(queue?.queue_depth ?? queuedStatuses.reduce((sum, value) => sum + Number(statusCounts[value] ?? 0), 0)),
      active: Number(queue?.active_jobs ?? activeStatuses.reduce((sum, value) => sum + Number(statusCounts[value] ?? 0), 0)),
      failed24h: Number(queue?.failed_24h ?? statusCounts.failed ?? 0),
    };
  }, [jobs.length, queue]);

  const loadJob = React.useCallback(async (job: JobRecord, tab: DetailTab = 'overview') => {
    clearFailure();
    try {
      const detail = await api.getJob(Number(job.job_id ?? job.id));
      setSelectedJob(detail);
      setActiveTab(tab);
      setStatus(`Loaded job ${jobId(detail)}.`);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  const copyJobId = React.useCallback(async () => {
    if (!selectedJob) return;
    const id = jobId(selectedJob);
    try {
      await navigator.clipboard.writeText(id);
      setStatus(`Copied job ${id}.`);
    } catch {
      setStatus(`Job ID ${id}`);
    }
  }, [selectedJob]);

  const clearFilters = React.useCallback(() => {
    setJobIdQuery('');
    setStatusFilters([]);
    setTypeFilters([]);
    setActorFilters([]);
    setStartDate('');
    setEndDate('');
  }, []);

  const performAction = React.useCallback(async (action: PendingAction['action'], ids: string[]) => {
    clearFailure();
    let changed = 0;
    const candidates = jobs.filter((job) => ids.includes(jobId(job)));
    for (const job of candidates) {
      const id = Number(job.job_id ?? job.id);
      try {
        if (action === 'cancel' && canCancel(job) && canMutateJobs) {
          await api.cancelJob(id);
          changed += 1;
        } else if (action === 'retry' && canRetry(job) && canMutateJobs) {
          await api.retryJob(id, Number(job.priority ?? 0));
          changed += 1;
        } else if (action === 'delete' && canDelete(job) && isAdmin) {
          await api.removeJob(id);
          changed += 1;
        }
      } catch (error) {
        captureFailure(error);
        setStatus(`${action} failed for job ${id}: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    setPendingAction(null);
    setStatus(changed > 0 ? `${action} selected success: ${changed} job(s).` : `No eligible jobs for ${action}.`);
    await refresh();
  }, [api, canMutateJobs, captureFailure, clearFailure, isAdmin, jobs, refresh]);

  const jobColumns = React.useMemo<DataColumn<JobRecord>[]>(() => [
    {
      id: 'job_id',
      header: 'Job ID',
      cell: (job) => (
        <button
          type="button"
          className="font-mono text-xs text-foreground hover:underline"
          onClick={() => void loadJob(job)}
        >
          {jobId(job)}
        </button>
      ),
      sortable: true,
      sortValue: (job) => Number(job.job_id ?? job.id ?? 0),
    },
    {
      id: 'job_type',
      header: 'Type',
      cell: (job) => truncate(jobType(job), 34),
      sortable: true,
      sortValue: (job) => jobType(job),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (job) => <JobStatusBadge status={job.status} />,
      sortable: true,
      sortValue: (job) => normaliseStatus(job.status),
    },
    {
      id: 'created_at',
      header: 'Created',
      cell: (job) => <DateCell value={job.created_at} />,
      sortable: true,
      sortValue: (job) => timestampSortValue(job.created_at),
    },
    {
      id: 'started_at',
      header: 'Started',
      cell: (job) => <DateCell value={job.started_at} />,
      sortable: true,
      sortValue: (job) => timestampSortValue(job.started_at),
    },
    {
      id: 'updated_at',
      header: 'Updated',
      cell: (job) => <DateCell value={job.updated_at} />,
      sortable: true,
      sortValue: (job) => timestampSortValue(job.updated_at),
    },
    {
      id: 'completed_at',
      header: 'Completed',
      cell: (job) => <DateCell value={job.completed_at ?? job.finished_at} />,
      sortable: true,
      sortValue: (job) => timestampSortValue(job.completed_at ?? job.finished_at),
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: (job) => truncate(actorLabel(job), 28),
      sortable: true,
      sortValue: (job) => actorLabel(job),
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: (job) => formatDuration(job),
      sortable: true,
      sortValue: (job) => Number(job.duration_seconds ?? -1),
    },
    {
      id: 'result_link',
      header: 'Result link',
      cell: (job) => (
        <a
          href={`/jobs?job=${jobId(job)}&tab=result`}
          className="text-sm text-primary hover:underline"
          onClick={(event) => {
            event.preventDefault();
            void loadJob(job, 'result');
          }}
        >
          Result
        </a>
      ),
      sortable: true,
      sortValue: (job) => String(job.result_ref ?? job.outcome_summary ?? job.response_received ?? ''),
    },
    {
      id: 'log_link',
      header: 'Log link',
      cell: (job) => (
        <a
          href={`/jobs?job=${jobId(job)}&tab=lifecycle`}
          className="text-sm text-primary hover:underline"
          onClick={(event) => {
            event.preventDefault();
            void loadJob(job, 'lifecycle');
          }}
        >
          Logs
        </a>
      ),
      sortable: true,
      sortValue: (job) => Number(job.lifecycle_log?.length ?? job.call_logs?.length ?? 0),
    },
    {
      id: 'retry_count',
      header: 'Retry count',
      cell: (job) => String(retryCount(job)),
      sortable: true,
      sortValue: (job) => retryCount(job),
    },
  ], [loadJob]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Cancel Selected', action: 'cancel' },
    { label: 'Retry Selected', action: 'retry' },
    ...(isAdmin ? [{ label: 'Delete Selected', action: 'delete' }] : []),
  ], [isAdmin]);

  if (!canReadJobs) {
    return (
      <PageScaffold
        title="Jobs"
        description="Operational queue and background job state using live CRUD and detail surfaces."
        alert="Insufficient permissions to view jobs."
      >
        <p className="text-sm text-muted-foreground">The current session cannot read jobs.</p>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Jobs"
      description="Operational queue and background job state using the PS-76 standard job-control view."
      alert={latestFailure}
      status={status}
    >
      <LoadingNote loading={loading} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Jobs" value={formatCount(metrics.total)} />
        <MetricCard label="Queue Depth" value={formatCount(metrics.queueDepth)} />
        <MetricCard label="Active Jobs" value={formatCount(metrics.active)} />
        <MetricCard label="Failed (24h)" value={formatCount(metrics.failed24h)} />
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-medium">Job ID search</span>
            <Input
              className="rounded-md border px-3 py-2"
              value={jobIdQuery}
              onChange={(event) => setJobIdQuery(event.target.value)}
              placeholder="Exact job ID"
              aria-label="Job ID search"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Status filter</span>
            <Select
              multiple
              className="min-h-20 rounded-md border px-3 py-2"
              value={statusFilters}
              onChange={(event) => setStatusFilters(selectedOptions(event))}
              aria-label="Status filter"
            >
              {statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Type filter</span>
            <Select
              multiple
              className="min-h-20 rounded-md border px-3 py-2"
              value={typeFilters}
              onChange={(event) => setTypeFilters(selectedOptions(event))}
              aria-label="Type filter"
            >
              {typeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Actor filter</span>
            <Select
              multiple
              className="min-h-20 rounded-md border px-3 py-2"
              value={actorFilters}
              onChange={(event) => setActorFilters(selectedOptions(event))}
              aria-label="Actor filter"
            >
              {actorOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </label>
          <div className="grid gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Start date</span>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                aria-label="Start date"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">End date</span>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                aria-label="End date"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Refresh jobs
          </Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">
            Total Records: {filteredJobs.length} - Page {page} of {Math.max(1, Math.ceil(filteredJobs.length / pageSize))}
          </p>
        </div>

        <DataTable
          columns={jobColumns}
          rows={filteredJobs}
          totalRows={filteredJobs.length}
          emptyMessage="No jobs found."
          getRowId={jobId}
          getRowName={(job) => `Job ${jobId(job)} ${normaliseStatus(job.status)} ${actorLabel(job)}`}
          getSelectionLabel={(job) => `Select job ${jobId(job)}`}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          selectable
          selectionColumnPosition="start"
          bulkActions={bulkActions}
          onBulkAction={(action, selectedIds) => {
            const labels: Record<string, string> = {
              cancel: `Cancel ${selectedIds.length} selected job(s)?`,
              retry: `Retry ${selectedIds.length} selected job(s)?`,
              delete: `Delete ${selectedIds.length} selected job(s)?`,
            };
            setPendingAction({
              action: action as PendingAction['action'],
              jobIds: selectedIds,
              label: labels[action] ?? action,
            });
          }}
          columnPickerEnabled
          tableId="expert-agent-jobs-w28a-688"
        />
      </div>

      <Dialog open={selectedJob !== null} onOpenChange={(open) => { if (!open) setSelectedJob(null); }} label="Job detail dialog">
        {selectedJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Job {jobId(selectedJob)} detail</h2>
                <p className="text-sm text-muted-foreground">{jobType(selectedJob)} - {actorLabel(selectedJob)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => void copyJobId()}>
                  Copy Job ID
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canRetry(selectedJob)}
                  onClick={() => setPendingAction({ action: 'retry', jobIds: [jobId(selectedJob)], label: `Retry job ${jobId(selectedJob)}?` })}
                >
                  Retry
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canCancel(selectedJob)}
                  onClick={() => setPendingAction({ action: 'cancel', jobIds: [jobId(selectedJob)], label: `Cancel job ${jobId(selectedJob)}?` })}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!isAdmin || !canDelete(selectedJob)}
                  onClick={() => setPendingAction({ action: 'delete', jobIds: [jobId(selectedJob)], label: `Delete job ${jobId(selectedJob)}?` })}
                >
                  Delete
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)}>
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="parameters">Parameters</TabsTrigger>
                <TabsTrigger value="input">Input ref</TabsTrigger>
                <TabsTrigger value="result">Result/Output</TabsTrigger>
                <TabsTrigger value="thinking">Thinking</TabsTrigger>
                <TabsTrigger value="lifecycle">Lifecycle log</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div><dt className="font-medium">Status</dt><dd><JobStatusBadge status={selectedJob.status} /></dd></div>
                  <div><dt className="font-medium">Created</dt><dd>{selectedJob.created_at ?? '-'}</dd></div>
                  <div><dt className="font-medium">Started</dt><dd>{selectedJob.started_at ?? '-'}</dd></div>
                  <div><dt className="font-medium">Updated</dt><dd>{selectedJob.updated_at ?? '-'}</dd></div>
                  <div><dt className="font-medium">Completed</dt><dd>{selectedJob.completed_at ?? selectedJob.finished_at ?? '-'}</dd></div>
                  <div><dt className="font-medium">Duration</dt><dd>{formatDuration(selectedJob)}</dd></div>
                  <div><dt className="font-medium">Retry count</dt><dd>{retryCount(selectedJob)}</dd></div>
                  <div><dt className="font-medium">Trace ID</dt><dd className="font-mono text-xs">{selectedJob.trace_id ?? '-'}</dd></div>
                </dl>
              </TabsContent>
              <TabsContent value="parameters">
                <JsonBlock title="Parameters" value={selectedJob.parameters ?? selectedJob.metadata?.request_arguments ?? {}} defaultCollapsed={false} copyAriaLabel="Copy parameters JSON" />
              </TabsContent>
              <TabsContent value="input">
                <JsonBlock title="Input ref" value={selectedJob.input_ref ?? {
                  session_id: selectedJob.session_id,
                  channel_id: selectedJob.channel_id,
                  user_id: selectedJob.user_id,
                  prompt_sent: selectedJob.prompt_sent,
                }} defaultCollapsed={false} copyAriaLabel="Copy input ref JSON" />
              </TabsContent>
              <TabsContent value="result">
                <JsonBlock title="Result/Output" value={{
                  result_ref: selectedJob.result_ref,
                  outcome_summary: selectedJob.outcome_summary ?? selectedJob.outcome,
                  response_received: selectedJob.response_received,
                  last_error: selectedJob.last_error ?? selectedJob.error_info,
                }} defaultCollapsed={false} copyAriaLabel="Copy result JSON" />
              </TabsContent>
              <TabsContent value="thinking">
                <JsonBlock title="Thinking" value={selectedJob.thinking ?? selectedJob.metadata?.thinking ?? {}} defaultCollapsed={false} copyAriaLabel="Copy thinking JSON" />
              </TabsContent>
              <TabsContent value="lifecycle">
                <JsonBlock title="Lifecycle log" value={selectedJob.lifecycle_log ?? selectedJob.call_logs ?? []} defaultCollapsed={false} copyAriaLabel="Copy lifecycle JSON" />
              </TabsContent>
              <TabsContent value="raw">
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/20 p-3 text-xs font-mono">
                  {formatJson(selectedJob)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }} label="Confirm job action">
        {pendingAction ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{pendingAction.label}</h2>
            <p className="text-sm text-muted-foreground">
              {pendingAction.action === 'delete' ? 'This permanently removes eligible terminal jobs.' : 'This changes eligible live job state.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingAction(null)}>
                Close
              </Button>
              <Button
                type="button"
                variant={pendingAction.action === 'delete' ? 'destructive' : 'default'}
                onClick={() => void performAction(pendingAction.action, pendingAction.jobIds)}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </PageScaffold>
  );
}
