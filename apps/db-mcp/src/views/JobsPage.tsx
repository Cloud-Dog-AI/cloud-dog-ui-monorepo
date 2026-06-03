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

// PS-76 v2 Job Control WebUI for db-mcp-server.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
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
} from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";
import type { JobSummary, PrincipalSummary } from "../lib/types";

type ActionName = "cancel" | "retry" | "delete";

const STATUS_OPTIONS = [
  "created",
  "validated",
  "queued",
  "dispatched",
  "running",
  "retry_wait",
  "blocked",
  "paused",
  "succeeded",
  "failed",
  "cancelled",
  "timeout",
  "dead_lettered",
  "archived",
];

const CANCELLABLE = new Set(["created", "validated", "queued", "scheduled", "dispatched", "running", "blocked", "paused"]);
const RETRYABLE = new Set(["failed", "timeout", "timed_out", "dead_lettered"]);
const TERMINAL = new Set(["succeeded", "failed", "cancelled", "timeout", "timed_out", "dead_lettered", "ttl_expired", "archived"]);
const NOT_STARTED = new Set(["created", "validated", "queued", "scheduled", "blocked"]);

function str(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function parseDateMs(value: unknown): number {
  const ms = Date.parse(str(value));
  return Number.isFinite(ms) ? ms : 0;
}

function jobId(row: JobSummary): string {
  return str(row.job_id || row.id);
}

function jobType(row: JobSummary): string {
  return str(row.job_type || row.name);
}

function lifecycleStatus(row: JobSummary): string {
  return str(row.status, "unknown").toLowerCase();
}

function actorName(row: JobSummary): string {
  return str(row.request_auth_identity || row.actor || row.user_id || "system");
}

function retryCount(row: JobSummary): number {
  const attempt = Number(row.attempt ?? 0);
  return Number.isFinite(attempt) && attempt > 0 ? attempt : 0;
}

function timestampFor(row: JobSummary, key: "created" | "started" | "updated" | "completed"): string {
  if (key === "created") return str(row.created_at);
  if (key === "updated") return str(row.updated_at || row.finished_at || row.started_at || row.created_at);
  if (key === "completed") return TERMINAL.has(lifecycleStatus(row)) ? str(row.finished_at || row.completed_at || row.updated_at) : "";
  if (NOT_STARTED.has(lifecycleStatus(row))) return "";
  return str(row.started_at || row.created_at);
}

function formatDuration(row: JobSummary): string {
  let seconds = Number(row.duration_seconds);
  const started = parseDateMs(timestampFor(row, "started"));
  const completed = parseDateMs(timestampFor(row, "completed"));
  if ((!Number.isFinite(seconds) || seconds < 0) && started > 0) {
    seconds = Math.max(0, ((completed > 0 ? completed : Date.now()) - started) / 1000);
  }
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest ? `${minutes} min ${rest} sec` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours} hr ${rem} min` : `${hours} hr`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function statusBadgeStyle(status: string): React.CSSProperties | undefined {
  if (status === "succeeded") return { backgroundColor: "rgb(5, 150, 105)" };
  if (["failed", "dead_lettered", "timeout", "timed_out"].includes(status)) return { backgroundColor: "rgb(185, 28, 28)" };
  if (["retry_wait", "blocked", "paused"].includes(status)) return { backgroundColor: "rgb(254, 243, 199)" };
  return undefined;
}

function statusBadgeClass(status: string): string {
  if (status === "succeeded") return "text-white border-emerald-700";
  if (["failed", "dead_lettered", "timeout", "timed_out"].includes(status)) return "text-white border-red-800";
  if (["retry_wait", "blocked", "paused"].includes(status)) return "text-amber-950 border-amber-500";
  return "";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      data-testid={`job-status-${status}`}
      data-status={status}
      variant={["failed", "dead_lettered", "timeout", "timed_out"].includes(status) ? "destructive" : status === "succeeded" ? "default" : "secondary"}
      className={statusBadgeClass(status)}
      style={statusBadgeStyle(status)}
    >
      {status}
    </Badge>
  );
}

function ToggleChip(props: { label: string; selected: boolean; onClick: () => void; testId?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={props.selected ? "default" : "secondary"}
      aria-pressed={props.selected}
      data-testid={props.testId}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}

function hasAdminRights(principal: PrincipalSummary | null, authUser: ReturnType<typeof useAuth>["user"]): boolean {
  const roles = new Set([...(principal?.roles ?? []), ...(authUser?.roles ?? [])]);
  const permissions = new Set([...(principal?.permissions ?? []), ...(authUser?.permissions ?? [])]);
  return roles.has("admin") || roles.has("system_admin") || permissions.has("*") || permissions.has("jobs.delete");
}

export function JobsPage() {
  const auth = useAuth();
  const { api } = useDbMcpState();
  const [rows, setRows] = React.useState<JobSummary[]>([]);
  const [principal, setPrincipal] = React.useState<PrincipalSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{ action: ActionName; ids: string[] } | null>(null);
  const [actionBusy, setActionBusy] = React.useState(false);
  const [detailJob, setDetailJob] = React.useState<JobSummary | null>(null);
  const [detailTab, setDetailTab] = React.useState("overview");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [jobIdSearch, setJobIdSearch] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<Set<string>>(() => new Set());
  const [typeFilters, setTypeFilters] = React.useState<Set<string>>(() => new Set());
  const [actorFilters, setActorFilters] = React.useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [refreshVersion, setRefreshVersion] = React.useState(0);
  const [urlJobChecked, setUrlJobChecked] = React.useState("");
  const isAdmin = hasAdminRights(principal, auth.user);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void Promise.all([
      api.listJobs(1000),
      api.currentPrincipal().catch(() => null),
    ])
      .then(([jobs, currentPrincipal]) => {
        if (cancelled) return;
        setRows(jobs);
        setPrincipal(currentPrincipal);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshVersion]);

  const refresh = React.useCallback(() => setRefreshVersion((value) => value + 1), []);

  const statusOptions = React.useMemo(() => unique([...STATUS_OPTIONS, ...rows.map(lifecycleStatus)]), [rows]);
  const typeOptions = React.useMemo(() => unique(rows.map(jobType)), [rows]);
  const actorOptions = React.useMemo(() => unique(rows.map(actorName)), [rows]);

  const filteredRows = React.useMemo(() => {
    const exactId = jobIdSearch.trim();
    const fromMs = dateFrom ? Date.parse(`${dateFrom}T00:00:00`) : 0;
    const toMs = dateTo ? Date.parse(`${dateTo}T23:59:59`) : 0;
    return rows
      .filter((row) => {
        if (exactId && jobId(row) !== exactId) return false;
        if (statusFilters.size && !statusFilters.has(lifecycleStatus(row))) return false;
        if (typeFilters.size && !typeFilters.has(jobType(row))) return false;
        if (isAdmin && actorFilters.size && !actorFilters.has(actorName(row))) return false;
        const createdMs = parseDateMs(timestampFor(row, "created"));
        if (fromMs && createdMs < fromMs) return false;
        if (toMs && createdMs > toMs) return false;
        return true;
      })
      .sort((a, b) => parseDateMs(timestampFor(b, "created")) - parseDateMs(timestampFor(a, "created")));
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
      if (["created", "validated", "queued"].includes(status)) queued += 1;
      if (["dispatched", "running"].includes(status)) active += 1;
      if (["failed", "timeout", "dead_lettered"].includes(status) && parseDateMs(timestampFor(row, "updated")) >= dayAgo) failed24h += 1;
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

  const selectedRowsFor = React.useCallback((ids: string[]) => rows.filter((row) => ids.includes(jobId(row))), [rows]);

  const validateBulkAction = React.useCallback(
    (action: ActionName, ids: string[]): string | null => {
      if (action === "delete" && !isAdmin) return "403 Forbidden: delete requires admin";
      const selectedRows = selectedRowsFor(ids);
      if (selectedRows.length !== ids.length) return null;
      if (action === "cancel" && selectedRows.some((row) => !CANCELLABLE.has(lifecycleStatus(row)))) {
        return "Bulk Cancel Selected only applies to non-terminal jobs.";
      }
      if (action === "retry" && selectedRows.some((row) => !RETRYABLE.has(lifecycleStatus(row)))) {
        return "Bulk Retry Selected only applies to failed, timeout, or dead_lettered jobs.";
      }
      if (action === "delete" && selectedRows.some((row) => !TERMINAL.has(lifecycleStatus(row)))) {
        return "Bulk Delete Selected only applies to terminal jobs.";
      }
      return null;
    },
    [isAdmin, selectedRowsFor],
  );

  const requestBulkAction = React.useCallback(
    (action: ActionName, ids: string[]) => {
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

  const openDetail = React.useCallback(
    async (idOrRow: string | JobSummary) => {
      const id = typeof idOrRow === "string" ? idOrRow : jobId(idOrRow);
      if (!id) return;
      setInlineError(null);
      try {
        const latest = await api.getJob(id);
        if (!latest) throw new Error(`Job not found: ${id}`);
        setDetailJob(latest);
        setDetailTab("overview");
      } catch (error) {
        setDetailJob(null);
        setInlineError(error instanceof Error ? error.message : String(error));
      }
    },
    [api],
  );

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("job_id") || params.get("jobId");
    if (!id || id === urlJobChecked) return;
    setUrlJobChecked(id);
    void openDetail(id);
    const bulkAction = params.get("bulk");
    if (bulkAction === "cancel" || bulkAction === "retry" || bulkAction === "delete") {
      setPendingAction({ action: bulkAction, ids: [id] });
    }
  }, [openDetail, urlJobChecked]);

  const performAction = React.useCallback(async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    setActionError(null);
    try {
      for (const id of pendingAction.ids) {
        if (pendingAction.action === "cancel") await api.cancelJob(id);
        else if (pendingAction.action === "retry") await api.retryJob(id);
        else await api.deleteJob(id);
      }
      setPendingAction(null);
      setDetailJob(null);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActionBusy(false);
    }
  }, [api, pendingAction, refresh]);

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: "Bulk Cancel Selected", action: "cancel" },
      { label: "Bulk Retry Selected", action: "retry" },
      ...(isAdmin ? [{ label: "Bulk Delete Selected", action: "delete" }] : []),
    ],
    [isAdmin],
  );

  const columns: DataColumn<JobSummary>[] = React.useMemo(
    () => [
      {
        id: "job_id",
        header: "Job ID",
        cell: (row) => (
          <Button className="max-w-[13rem] truncate font-mono text-xs" onClick={() => { void openDetail(row); }} type="button" title={jobId(row)} variant="link">
            {jobId(row)}
          </Button>
        ),
        sortable: true,
        sortValue: (row) => parseInt(jobId(row).replace(/-/g, "").slice(0, 12), 16),
      },
      { id: "type", header: "Type", cell: jobType, sortable: true, sortValue: jobType },
      { id: "status", header: "Status", cell: (row) => <StatusBadge status={lifecycleStatus(row)} />, sortable: true, sortValue: lifecycleStatus },
      {
        id: "created_at",
        header: "Created",
        cell: (row) => timestampFor(row, "created") ? <RelativeTime timestamp={timestampFor(row, "created")} /> : "",
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, "created")),
      },
      {
        id: "started_at",
        header: "Started",
        cell: (row) => timestampFor(row, "started") ? <RelativeTime timestamp={timestampFor(row, "started")} /> : "",
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, "started")),
      },
      {
        id: "updated_at",
        header: "Updated",
        cell: (row) => timestampFor(row, "updated") ? <RelativeTime timestamp={timestampFor(row, "updated")} /> : "",
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, "updated")),
      },
      {
        id: "completed_at",
        header: "Completed",
        cell: (row) => timestampFor(row, "completed") ? <RelativeTime timestamp={timestampFor(row, "completed")} /> : "",
        sortable: true,
        sortValue: (row) => parseDateMs(timestampFor(row, "completed")),
      },
      { id: "actor", header: "Actor", cell: actorName, sortable: true, sortValue: actorName },
      { id: "duration", header: "Duration", cell: formatDuration, sortable: true, sortValue: (row) => Number(row.duration_seconds ?? 0) },
      {
        id: "result_link",
        header: "Result link",
        cell: (row) => <Button type="button" variant="link" className="h-auto p-0" onClick={() => { void openDetail(row); }}>Result</Button>,
        sortable: true,
        sortValue: jobId,
      },
      {
        id: "log_link",
        header: "Log link",
        cell: (row) => <a className="text-primary underline-offset-4 hover:underline" href={`/logs?job_id=${encodeURIComponent(jobId(row))}`}>Logs</a>,
        sortable: true,
        sortValue: jobId,
      },
      { id: "retry_count", header: "Retry count", cell: (row) => retryCount(row), sortable: true, sortValue: retryCount },
    ],
    [openDetail],
  );

  const detailStatus = detailJob ? lifecycleStatus(detailJob) : "";
  const detailId = detailJob ? jobId(detailJob) : "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-muted-foreground">Queue lifecycle, RBAC controls, filters, and job inspection.</p>
        </div>
        <Button variant="secondary" onClick={refresh} type="button">Refresh</Button>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Jobs" value={metrics.total} />
        <MetricCard label="Queue Depth" value={metrics.queued} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Failed (24h)" value={metrics.failed24h} tone={metrics.failed24h > 0 ? "warning" : "default"} />
      </div>

      <div className="space-y-3 rounded-md border border-border bg-background p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,20rem)_1fr]">
          <label className="text-sm font-medium">
            <span className="mb-1 block">Search Job ID</span>
            <Input placeholder="Exact Job ID" value={jobIdSearch} onChange={(event) => setJobIdSearch(event.target.value)} data-testid="jobs-search-job-id" />
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
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <ToggleChip key={status} label={status} selected={statusFilters.has(status)} onClick={() => toggleSetValue(setStatusFilters, status)} testId={`filter-status-${status}`} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Type</p>
          <div className="flex flex-wrap gap-2">
            {(typeOptions.length ? typeOptions : ["discovery.rebuild", "discovery.sync_profile", "discovery.sync_entity"]).map((type) => (
              <ToggleChip key={type} label={type} selected={typeFilters.has(type)} onClick={() => toggleSetValue(setTypeFilters, type)} testId={`filter-type-${type}`} />
            ))}
          </div>
        </div>

        {isAdmin ? (
          <div data-testid="jobs-actor-filter">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Actor</p>
            <div className="flex flex-wrap gap-2">
              {actorOptions.map((actor) => (
                <ToggleChip key={actor} label={actor} selected={actorFilters.has(actor)} onClick={() => toggleSetValue(setActorFilters, actor)} testId={`filter-actor-${actor}`} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {inlineError ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inlineError}</div> : null}
      {actionError ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div> : null}
      {loadError ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span data-testid="jobs-total-records">Total Records: {filteredRows.length}</span>
        <span data-testid="jobs-page-count">Page {Math.min(page, totalPages)} of {totalPages}</span>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        emptyMessage={loading ? "Loading jobs..." : "No jobs found."}
        getRowId={jobId}
        getSelectionLabel={(row) => `Select job ${jobId(row)}`}
        getRowName={(row) => `Job ${jobId(row)} ${jobType(row)} ${lifecycleStatus(row)} ${actorName(row)}`}
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
          if (action === "cancel" || action === "retry" || action === "delete") requestBulkAction(action, selectedIds);
        }}
        tableId="db-mcp-jobs-ps76-v2"
        ariaLabel="DB MCP jobs"
      />

      <Dialog open={detailJob !== null} onOpenChange={(open) => { if (!open) setDetailJob(null); }} label={detailId ? `Job ${detailId}` : "Job detail"}>
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
              <Button type="button" variant="secondary" size="sm" onClick={() => { void navigator.clipboard?.writeText(detailId); }}>Copy Job ID</Button>
              <Button type="button" variant="secondary" size="sm" disabled={!RETRYABLE.has(detailStatus)} onClick={() => requestBulkAction("retry", [detailId])}>Retry</Button>
              <Button type="button" variant="secondary" size="sm" disabled={!CANCELLABLE.has(detailStatus)} onClick={() => requestBulkAction("cancel", [detailId])}>Cancel</Button>
              {isAdmin ? (
                <Button type="button" variant="destructive" size="sm" disabled={!TERMINAL.has(detailStatus)} onClick={() => requestBulkAction("delete", [detailId])}>Delete</Button>
              ) : null}
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
                    ["Job ID", detailId],
                    ["Type", jobType(detailJob)],
                    ["Status", detailStatus],
                    ["Actor", actorName(detailJob)],
                    ["Created", timestampFor(detailJob, "created")],
                    ["Started", timestampFor(detailJob, "started")],
                    ["Updated", timestampFor(detailJob, "updated")],
                    ["Completed", timestampFor(detailJob, "completed")],
                    ["Duration", formatDuration(detailJob)],
                    ["Retry count", String(retryCount(detailJob))],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words text-sm">{value || ""}</dd>
                    </div>
                  ))}
                </dl>
              </TabsContent>

              <TabsContent value="parameters">
                <JsonBlock title="Parameters" value={detailJob.payload ?? {}} />
              </TabsContent>
              <TabsContent value="input_ref">
                <JsonBlock title="Input ref" value={{
                  request_source: detailJob.request_source,
                  request_auth_method: detailJob.request_auth_method,
                  request_auth_identity: detailJob.request_auth_identity,
                  correlation_id: detailJob.correlation_id,
                  server_id: detailJob.server_id,
                  worker_id: detailJob.worker_id,
                }} />
              </TabsContent>
              <TabsContent value="result_output">
                <JsonBlock title="Result/Output" value={{ result_ref: detailJob.result_ref, last_error: detailJob.last_error, progress: detailJob.progress }} />
              </TabsContent>
              <TabsContent value="thinking">
                <p className="text-sm text-muted-foreground">No thinking trace recorded for db-mcp discovery jobs.</p>
              </TabsContent>
              <TabsContent value="lifecycle_log">
                <JsonBlock title="Lifecycle log" value={detailJob.lifecycle_history ?? detailJob.progress ?? []} />
              </TabsContent>
              <TabsContent value="raw">
                <CodeViewer title="Raw job record" language="json" code={JSON.stringify(detailJob, null, 2)} />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title={pendingAction ? `Confirm ${pendingAction.action}` : "Confirm action"}
        description={pendingAction ? `${pendingAction.action} ${pendingAction.ids.length} selected job(s).` : ""}
        targetName={pendingAction?.ids.join(", ")}
        confirmLabel="Confirm"
        confirmVariant={pendingAction?.action === "delete" ? "destructive" : "default"}
        irreversible={pendingAction?.action === "delete"}
        loading={actionBusy}
        error={actionError}
        onConfirm={() => { void performAction(); }}
      />
    </div>
  );
}
