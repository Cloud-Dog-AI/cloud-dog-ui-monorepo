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

// @cloud-dog/app-git-mcp — Jobs page (PS-76 v2 compliant).
// Standard: PS-76 v2 (Job Control WebUI Standard)

import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAuditLink,
  type BulkAction,
  type DataColumn,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { JobRecord } from "../lib/types";

// ---------------------------------------------------------------------------
// PS-76 v2 JW3 — Status colour mapping
// ---------------------------------------------------------------------------

const STATUS_TERMINAL = new Set([
  "succeeded", "completed", "failed", "cancelled", "timeout",
  "timed_out", "dead_lettered", "ttl_expired", "archived",
]);
const STATUS_CANCELLABLE = new Set([
  "created", "queued", "scheduled", "dispatched", "running", "blocked", "paused",
]);
const STATUS_RETRYABLE = new Set([
  "failed", "cancelled", "timeout", "timed_out", "dead_lettered",
]);
const STATUS_WARNING = new Set(["retry_wait", "blocked", "paused"]);
const STATUS_SUCCESS = new Set(["succeeded", "completed"]);
const STATUS_DESTRUCTIVE = new Set(["failed", "dead_lettered", "timeout", "timed_out"]);

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  const s = (status ?? "").toLowerCase();
  if (STATUS_SUCCESS.has(s)) return "default";
  if (STATUS_DESTRUCTIVE.has(s)) return "destructive";
  return "secondary";
}

function statusBadgeClassName(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (STATUS_SUCCESS.has(s)) return "bg-green-100 text-green-800 border-green-300";
  if (STATUS_DESTRUCTIVE.has(s)) return "";
  if (STATUS_WARNING.has(s)) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  if (s === "cancelled") return "line-through opacity-70";
  if (s === "ttl_expired") return "text-red-400 opacity-80";
  if (s === "archived") return "opacity-50";
  return "";
}

function formatDuration(job: JobRecord): string {
  const start = Date.parse(job.started_at || job.created_at);
  const end = Date.parse(job.finished_at || job.updated_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "\u2014";
  const n = Math.round((end - start) / 1000);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function sentenceCase(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobsPageView() {
  const app = useGitMcpState();
  const navigate = useNavigate();
  const location = useLocation();
  const { linkToJob, linkToCorrelation } = useAuditLink();
  // Deep-link filter: `/jobs?job_id=<id>` (or `?q=<text>`) pre-filters the table
  // to that job so an external link (e.g. an async-submit follow-up) lands on the
  // exact row regardless of how many jobs exist / pagination.
  const initialQuery = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("job_id") ?? params.get("q") ?? "").trim();
  }, [location.search]);
  // J-07: deep-link a job to the shared Audit page (by correlation, else job id).
  const auditHref = React.useCallback(
    (job: JobRecord) => (job.correlation_id ? linkToCorrelation(job.correlation_id) : linkToJob(job.job_id)),
    [linkToCorrelation, linkToJob],
  );
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [detailJob, setDetailJob] = React.useState<JobRecord | null>(null);
  const [detailTab, setDetailTab] = React.useState("overview");
  const [confirmAction, setConfirmAction] = React.useState<{
    action: string;
    jobIds: string[];
    label: string;
  } | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const listed = await app.loadJobs();
      setJobs(listed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    }
  }, [app]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Re-apply the deep-link filter when the URL query param changes (e.g. a
  // client-side nav to /jobs?job_id=<other-id> after the page is already mounted).
  React.useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  // -----------------------------------------------------------------------
  // PS-76 v2 JW8 — Summary metrics
  // -----------------------------------------------------------------------

  const metrics = React.useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let active = 0;
    let failed24h = 0;
    let queued = 0;
    for (const job of jobs) {
      const s = job.status.toLowerCase();
      if (s === "running" || s === "dispatched") active++;
      if (s === "queued") queued++;
      if (s === "failed" && (now - new Date(job.created_at).getTime()) < day) failed24h++;
    }
    return { total: jobs.length, queued, active, failed24h };
  }, [jobs]);

  const filteredJobs = React.useMemo(() => {
    const q = query.toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter && job.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (q) {
        if (!job.job_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [jobs, query, statusFilter]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const performAction = React.useCallback(
    async (action: string, jobIds: string[]) => {
      for (const id of jobIds) {
        try {
          if (action === "cancel") await app.cancelJob(id);
          else if (action === "retry") await app.retryJob(id);
          else if (action === "delete") await app.deleteJob(id);
        } catch { /* refresh shows current state */ }
      }
      setConfirmAction(null);
      void load();
    },
    [app, load],
  );

  // -----------------------------------------------------------------------
  // PS-76 v2 JW5 — Bulk actions
  // -----------------------------------------------------------------------

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: "Cancel Selected", action: "cancel" },
      { label: "Retry Selected", action: "retry" },
      { label: "Delete Selected", action: "delete" },
    ],
    [],
  );

  // -----------------------------------------------------------------------
  // PS-76 v2 JW2 — 12 mandatory columns + project-specific (JW11)
  // -----------------------------------------------------------------------

  const columns: DataColumn<JobRecord>[] = React.useMemo(
    () => [
      // 1. Job ID — clickable, non-empty
      {
        id: "job_id",
        header: "Job ID",
        cell: (row) => (
          <span
            className="cursor-pointer font-mono text-xs text-sky-700 hover:underline truncate max-w-[10rem] block"
            onClick={() => { setDetailJob(row); setDetailTab("overview"); }}
            title={row.job_id}
          >
            {row.job_id.slice(0, 12)}
          </span>
        ),
        sortable: true,
        sortValue: (row) => row.job_id,
      },
      // 2. Type
      {
        id: "job_type",
        header: "Type",
        cell: (row) => row.job_type || "\u2014",
        sortable: true,
        sortValue: (row) => row.job_type,
      },
      // 3. Status — badge with PS-76 v2 JW3 colours
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={statusBadgeVariant(row.status)} className={statusBadgeClassName(row.status)}>
            {sentenceCase(row.status)}
          </Badge>
        ),
        sortable: true,
        sortValue: (row) => row.status,
      },
      // 4. Created — RelativeTime
      {
        id: "created_at",
        header: "Created",
        cell: (row) => row.created_at ? <RelativeTime timestamp={row.created_at} /> : "\u2014",
        sortable: true,
        sortValue: (row) => row.created_at,
      },
      // 5. Started — RelativeTime, blank if not dispatched
      {
        id: "started_at",
        header: "Started",
        cell: (row) => row.started_at ? <RelativeTime timestamp={row.started_at} /> : "\u2014",
        sortable: true,
        sortValue: (row) => row.started_at || "",
      },
      // 6. Updated — RelativeTime
      {
        id: "updated_at",
        header: "Updated",
        cell: (row) => row.updated_at ? <RelativeTime timestamp={row.updated_at} /> : "\u2014",
        sortable: true,
        sortValue: (row) => row.updated_at || "",
      },
      // 7. Completed — RelativeTime, blank if not terminal
      {
        id: "finished_at",
        header: "Completed",
        cell: (row) => row.finished_at ? <RelativeTime timestamp={row.finished_at} /> : "\u2014",
        sortable: true,
        sortValue: (row) => row.finished_at || "",
      },
      // 8. Actor
      {
        id: "actor",
        header: "Actor",
        cell: (row) => {
          const identity = row.request_auth_identity || row.user_id;
          return identity ? `${identity}` : "\u2014";
        },
        sortable: true,
        sortValue: (row) => row.request_auth_identity || row.user_id || "",
      },
      // 9. Duration — relative format, NEVER raw seconds
      {
        id: "duration",
        header: "Duration",
        cell: (row) => formatDuration(row),
        sortable: true,
        sortValue: (row) => {
          const s = Date.parse(row.started_at || row.created_at);
          const e = Date.parse(row.finished_at || row.updated_at);
          return Number.isFinite(s) && Number.isFinite(e) ? e - s : 0;
        },
      },
      // 10. Result link
      {
        id: "result_link",
        header: "Result",
        cell: (row) => row.result ? (
          <span className="cursor-pointer text-sky-600 hover:underline text-xs" onClick={() => { setDetailJob(row); setDetailTab("result"); }}>View</span>
        ) : "\u2014",
      },
      // 11. Log link (J-07: deep-link to the shared Audit page for this job's log+audit trail)
      {
        id: "log_link",
        header: "Log",
        cell: (row) => row.correlation_id || row.job_id ? (
          <span className="cursor-pointer text-sky-600 hover:underline text-xs" onClick={() => navigate(auditHref(row))} title="Actions \u203a View Audit">View audit</span>
        ) : "\u2014",
      },
      // 12. Retry count
      {
        id: "attempt",
        header: "Retry count",
        cell: (row) => `${(row.attempt ?? 1) - 1}`,
        sortable: true,
        sortValue: (row) => row.attempt ?? 0,
      },
      // Project-specific (JW11): Repository
      {
        id: "repository",
        header: "Repository",
        cell: (row) => {
          const repo = row.payload?.profile ?? row.payload?.repo_source;
          return repo ? <span className="font-mono text-xs">{`${repo}`}</span> : "\u2014";
        },
        sortable: true,
        sortValue: (row) => `${row.payload?.profile ?? row.payload?.repo_source ?? ""}`,
      },
      // Row actions
      {
        id: "actions",
        header: "",
        cell: (row) => {
          const s = row.status.toLowerCase();
          return (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setDetailJob(row); setDetailTab("overview"); }}>Detail</Button>
              {STATUS_CANCELLABLE.has(s) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "cancel", jobIds: [row.job_id], label: "Cancel this job?" })}>Cancel</Button>
              )}
              {STATUS_RETRYABLE.has(s) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "retry", jobIds: [row.job_id], label: "Retry this job?" })}>Retry</Button>
              )}
              {STATUS_TERMINAL.has(s) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "delete", jobIds: [row.job_id], label: "Delete this job?" })}>Delete</Button>
              )}
            </div>
          );
        },
      },
    ],
    [navigate, auditHref],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-muted-foreground">Background job queue with bulk control, detail inspection, and runtime metrics.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>Refresh</Button>
      </header>

      {/* PS-76 v2 JW8 — Summary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Jobs" value={metrics.total} />
        <MetricCard label="Queue Depth" value={metrics.queued} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Failed (24h)" value={metrics.failed24h} tone={metrics.failed24h > 0 ? "warning" : "default"} />
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {/* PS-76 v2 JW4 — Detail panel (above table for Playwright visibility) */}
      <div className="rounded-lg border bg-background p-4 space-y-4" role="region" aria-label="Job detail">
        <h2 className="text-lg font-semibold">Job detail</h2>
        {detailJob ? (
          <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Job {detailJob.job_id.slice(0, 12)}</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(detailJob.job_id); }}>Copy Job ID</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(auditHref(detailJob))} title="Actions › View Audit">View Audit</Button>
              {STATUS_CANCELLABLE.has(detailJob.status.toLowerCase()) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "cancel", jobIds: [detailJob.job_id], label: "Cancel this job?" })}>Cancel</Button>
              )}
              {STATUS_RETRYABLE.has(detailJob.status.toLowerCase()) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "retry", jobIds: [detailJob.job_id], label: "Retry this job?" })}>Retry</Button>
              )}
              {STATUS_TERMINAL.has(detailJob.status.toLowerCase()) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "delete", jobIds: [detailJob.job_id], label: "Delete this job?" })}>Delete</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDetailJob(null)}>Close</Button>
            </div>
          </div>
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
              <TabsTrigger value="input">Input ref</TabsTrigger>
              <TabsTrigger value="result">Result / Output</TabsTrigger>
              <TabsTrigger value="thinking">Thinking</TabsTrigger>
              <TabsTrigger value="lifecycle">Lifecycle log</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Job ID", detailJob.job_id],
                  ["Type", detailJob.job_type],
                  ["Status", detailJob.status],
                  ["Actor", detailJob.request_auth_identity || detailJob.user_id || "\u2014"],
                  ["Created", detailJob.created_at],
                  ["Started", detailJob.started_at || "\u2014"],
                  ["Updated", detailJob.updated_at || "\u2014"],
                  ["Completed", detailJob.finished_at || "\u2014"],
                  ["Duration", formatDuration(detailJob)],
                  ["Retry count", `${(detailJob.attempt ?? 1) - 1}`],
                  ["Correlation ID", detailJob.correlation_id || "\u2014"],
                  ["Error", detailJob.error || "None"],
                ].map(([label, value]) => (
                  <div key={label} className="space-y-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="break-all text-sm text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
            <TabsContent value="parameters">
              <JsonBlock value={detailJob.payload ?? {}} title="Job Parameters" defaultCollapsed={false} />
            </TabsContent>
            <TabsContent value="input">
              <JsonBlock value={detailJob.payload ?? {}} title="Input Reference" defaultCollapsed={false} />
            </TabsContent>
            <TabsContent value="result">
              {detailJob.result ? <JsonBlock value={detailJob.result} title="Result / Output" defaultCollapsed={false} /> : <p className="text-sm text-muted-foreground">No result available.</p>}
            </TabsContent>
            <TabsContent value="thinking">
              <p className="text-sm text-muted-foreground">No thinking trace available for this job type.</p>
            </TabsContent>
            <TabsContent value="lifecycle">
              {detailJob.progress ? <JsonBlock value={detailJob.progress} title="Lifecycle Events" defaultCollapsed={false} /> : <p className="text-sm text-muted-foreground">No lifecycle events recorded.</p>}
            </TabsContent>
            <TabsContent value="raw">
              <JsonBlock value={detailJob as unknown as Record<string, unknown>} title="Full Job Record" defaultCollapsed={false} />
            </TabsContent>
          </Tabs>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a job to inspect its lifecycle, parameters, and result payload.</p>
        )}
      </div>

      {/* PS-76 v2 JW7 — Filter / Search / Pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by Job ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="created">Created</option>
          <option value="validated">Validated</option>
          <option value="queued">Queued</option>
          <option value="scheduled">Scheduled</option>
          <option value="dispatched">Dispatched</option>
          <option value="running">Running</option>
          <option value="blocked">Blocked</option>
          <option value="paused">Paused</option>
          <option value="retry_wait">Retry wait</option>
          <option value="succeeded">Succeeded</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="timeout">Timeout</option>
          <option value="timed_out">Timed out</option>
          <option value="dead_lettered">Dead lettered</option>
          <option value="ttl_expired">TTL expired</option>
          <option value="archived">Archived</option>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">Total Records: {filteredJobs.length}</span>
      </div>

      <DataTable
        columns={columns}
        rows={filteredJobs}
        emptyMessage="No jobs found."
        getRowId={(row) => row.job_id}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectable
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          const labels: Record<string, string> = {
            cancel: `Cancel ${selectedIds.length} job(s)?`,
            retry: `Retry ${selectedIds.length} job(s)?`,
            delete: `Delete ${selectedIds.length} job(s)?`,
          };
          setConfirmAction({ action, jobIds: selectedIds, label: labels[action] ?? action });
        }}
        columnPickerEnabled
        tableId="git-mcp-jobs"
      />

      {/* Confirmation dialog */}
      {confirmAction ? (
        <EntityDialog
          open={true}
          onOpenChange={() => setConfirmAction(null)}
          title={confirmAction.label}
          body={
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button
                  variant={confirmAction.action === "delete" ? "destructive" : "default"}
                  onClick={() => performAction(confirmAction.action, confirmAction.jobIds)}
                >
                  Confirm
                </Button>
              </div>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
