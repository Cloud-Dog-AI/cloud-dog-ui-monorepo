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

// @cloud-dog/app-chat-client — Jobs page (PS-76 v2 compliant).
// Standard: PS-76 (Job Control WebUI Standard) v2.0
// Sections: JW1 layout, JW2 columns, JW3 colour, JW4 detail dialog,
//           JW5 bulk actions, JW6 RBAC, JW7 filter/search/sort/pagination,
//           JW8 summary metrics, JW9 required components, JW11 project extension.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  Input,
  JsonBlock,
  MetricCard,
  RelativeTime,
  Select,
  StatusBadge,
  type BulkAction,
  type DataColumn,
  type StatusBadgeTone,
} from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "../lib/runtime-config";
import { useAppState } from "../state/AppState";
import { isAdminUser } from "../lib/rbac";
import type { JobRecord } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
}>;

// ---------------------------------------------------------------------------
// PS-76 JW3 — Status colour mapping (exact lifecycle groups)
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

function statusTone(status: string): StatusBadgeTone {
  const s = (status ?? "").toLowerCase();
  if (s === "succeeded" || s === "completed") return "ok";
  if (["failed", "dead_lettered", "timeout", "timed_out", "ttl_expired"].includes(s)) return "error";
  if (["retry_wait", "blocked", "paused"].includes(s)) return "warning";
  return "neutral";
}

function statusClassName(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled") return "line-through opacity-70";
  if (s === "archived") return "opacity-50";
  return "";
}

function formatDuration(job: JobRecord): string {
  const startTs = job.started_at ?? (job.payload as Record<string, unknown>)?.started_at;
  const start = typeof startTs === "string" ? Date.parse(startTs) : Date.parse(job.created_at);
  const endTs = job.finished_at ?? job.updated_at;
  const end = typeof endTs === "string" ? Date.parse(endTs) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const n = Math.round((end - start) / 1000);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobsPageView() {
  const { api } = useAppState();
  const auth = useAuth();
  const config = useConfig<RuntimeConfig>();
  const isAdmin = isAdminUser(auth.user);

  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [actorFilter, setActorFilter] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [detailJob, setDetailJob] = React.useState<JobRecord | null>(null);
  const [detailTab, setDetailTab] = React.useState<string>("Overview");
  const [confirmAction, setConfirmAction] = React.useState<{
    action: string;
    jobIds: string[];
    label: string;
  } | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const listed = await api.listJobs();
      setJobs(listed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  // -----------------------------------------------------------------------
  // PS-76 JW8 — Summary metrics
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

  // Distinct job types for the type filter chip (PS-76 JW7/JW12)
  const jobTypes = React.useMemo(
    () => [...new Set(jobs.map((j) => j.job_type).filter(Boolean))].sort(),
    [jobs],
  );

  // Distinct actors (admin-only, PS-76 JW7)
  const actors = React.useMemo(() => {
    if (!isAdmin) return [];
    const set = new Set<string>();
    for (const j of jobs) {
      const a = (j.payload as Record<string, unknown>)?.request_auth_identity ?? j.user_id;
      if (typeof a === "string" && a) set.add(a);
    }
    return [...set].sort();
  }, [jobs, isAdmin]);

  const filteredJobs = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter && job.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (typeFilter && job.job_type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (q && !job.job_id.toLowerCase().includes(q)) return false;
      if (actorFilter) {
        const a = String((job.payload as Record<string, unknown>)?.request_auth_identity ?? job.user_id ?? "").toLowerCase();
        if (a !== actorFilter.toLowerCase()) return false;
      }
      if (dateFrom) {
        const created = new Date(job.created_at).getTime();
        if (created < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo) {
        const created = new Date(job.created_at).getTime();
        if (created > new Date(dateTo + "T23:59:59").getTime()) return false;
      }
      return true;
    });
  }, [jobs, query, statusFilter, typeFilter, actorFilter, dateFrom, dateTo]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const baseUrl = config.API_BASE_URL ?? "";

  const performAction = React.useCallback(
    async (action: string, jobIds: string[]) => {
      for (const id of jobIds) {
        try {
          if (action === "cancel") {
            await fetch(`${baseUrl}/api/v1/jobs/${id}/cancel`, { method: "POST", credentials: "include" });
          } else if (action === "retry") {
            await fetch(`${baseUrl}/api/v1/jobs/${id}/retry`, { method: "POST", credentials: "include" });
          } else if (action === "delete") {
            await fetch(`${baseUrl}/api/v1/jobs/${id}`, { method: "DELETE", credentials: "include" });
          }
        } catch { /* refresh will show current state */ }
      }
      setConfirmAction(null);
      void load();
    },
    [baseUrl, load],
  );

  const exportJobs = React.useCallback(
    (selectedIds: string[]) => {
      const payload = jobs.filter((job) => selectedIds.includes(job.job_id));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "chat-client-jobs.json";
      link.click();
      URL.revokeObjectURL(url);
    },
    [jobs],
  );

  const copyJobId = React.useCallback((jobId: string) => {
    void navigator.clipboard.writeText(jobId);
  }, []);

  // -----------------------------------------------------------------------
  // PS-76 JW5 — Bulk actions (Delete hidden for non-admin per JW6)
  // -----------------------------------------------------------------------

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: "Cancel Selected", action: "cancel" },
      { label: "Retry Selected", action: "retry" },
      ...(isAdmin ? [{ label: "Delete Selected", action: "delete" }] : []),
      { label: "Export Selected", action: "export" },
    ],
    [isAdmin],
  );

  // -----------------------------------------------------------------------
  // PS-76 JW2 — 12 standard columns + project-specific (Session)
  // -----------------------------------------------------------------------

  const columns: DataColumn<JobRecord>[] = React.useMemo(
    () => [
      {
        id: "job_id",
        header: "Job ID",
        cell: (row) => (
          <Button
            className="font-mono text-xs text-sky-700 hover:underline truncate max-w-[10rem]"
            onClick={() => setDetailJob(row)}
            type="button"
            title={row.job_id}
          >
            {row.job_id.slice(0, 12)}
          </Button>
        ),
        sortable: true,
        sortValue: (row) => row.job_id,
      },
      {
        id: "job_type",
        header: "Type",
        cell: (row) => row.job_type || "—",
        sortable: true,
        sortValue: (row) => row.job_type,
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <StatusBadge value={row.status} tone={statusTone(row.status)} className={statusClassName(row.status)} />
        ),
        sortable: true,
        sortValue: (row) => row.status,
      },
      {
        id: "created_at",
        header: "Created",
        cell: (row) => row.created_at ? <RelativeTime timestamp={row.created_at} /> : "—",
        sortable: true,
        sortValue: (row) => row.created_at,
      },
      {
        id: "started_at",
        header: "Started",
        cell: (row) => {
          const ts = row.started_at ?? (row.payload as Record<string, unknown>)?.started_at;
          return typeof ts === "string" && ts ? <RelativeTime timestamp={ts} /> : "—";
        },
        sortable: true,
        sortValue: (row) => `${row.started_at ?? (row.payload as Record<string, unknown>)?.started_at ?? ""}`,
      },
      {
        id: "updated_at",
        header: "Updated",
        cell: (row) => row.updated_at ? <RelativeTime timestamp={row.updated_at} /> : "—",
        sortable: true,
        sortValue: (row) => row.updated_at,
      },
      {
        id: "completed_at",
        header: "Completed",
        cell: (row) => {
          const ts = row.finished_at ?? ((row.payload as Record<string, unknown>)?.finished_at as string);
          return typeof ts === "string" && ts ? <RelativeTime timestamp={ts} /> : "—";
        },
        sortable: true,
        sortValue: (row) => row.finished_at ?? "",
      },
      {
        id: "actor",
        header: "Actor",
        cell: (row) => {
          const p = row.payload as Record<string, unknown>;
          return `${p?.request_auth_identity ?? p?.user_id ?? row.user_id ?? "—"}`;
        },
        sortable: true,
        sortValue: (row) => `${(row.payload as Record<string, unknown>)?.request_auth_identity ?? row.user_id ?? ""}`,
      },
      {
        id: "duration",
        header: "Duration",
        cell: (row) => formatDuration(row),
        sortable: true,
        sortValue: (row) => {
          const s = Date.parse(row.created_at);
          const e = Date.parse(row.updated_at);
          return Number.isFinite(s) && Number.isFinite(e) ? e - s : 0;
        },
      },
      {
        id: "result_link",
        header: "Result link",
        cell: (row) => (
          <Button type="button" variant="link" className="p-0 text-xs text-sky-700 hover:underline" onClick={() => { setDetailJob(row); setDetailTab("Result/Output"); }}>
            Result
          </Button>
        ),
      },
      {
        id: "log_link",
        header: "Log link",
        cell: (row) => (
          <Button type="button" variant="link" className="p-0 text-xs text-sky-700 hover:underline"
            onClick={() => { window.location.href = `/monitoring?query=correlation_id:${encodeURIComponent(row.correlation_id ?? row.job_id)}`; }}>
            Log
          </Button>
        ),
      },
      {
        id: "retry_count",
        header: "Retry count",
        cell: (row) => `${row.attempt ?? 0}`,
        sortable: true,
        sortValue: (row) => row.attempt ?? 0,
      },
      // Project-specific: Conversation/Session ID (PS-76 JW11)
      {
        id: "session_id",
        header: "Session",
        cell: (row) => row.session_id ? <span className="font-mono text-xs">{row.session_id.slice(0, 12)}</span> : "—",
        sortable: true,
        sortValue: (row) => row.session_id,
      },
      // PS-76 JW4 — Row actions (Delete hidden for non-admin per JW6)
      {
        id: "actions",
        header: "",
        cell: (row) => {
          const s = row.status.toLowerCase();
          return (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDetailJob(row)}>Detail</Button>
              {STATUS_CANCELLABLE.has(s) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "cancel", jobIds: [row.job_id], label: "Cancel this job?" })}>Cancel</Button>
              )}
              {STATUS_RETRYABLE.has(s) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "retry", jobIds: [row.job_id], label: "Retry this job?" })}>Retry</Button>
              )}
              {isAdmin && STATUS_TERMINAL.has(s) && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ action: "delete", jobIds: [row.job_id], label: "Delete this job?" })}>Delete</Button>
              )}
            </div>
          );
        },
      },
    ],
    [isAdmin],
  );

  // -----------------------------------------------------------------------
  // PS-76 JW4 — Detail dialog controls
  // -----------------------------------------------------------------------

  const detailControls = React.useMemo(() => {
    if (!detailJob) return null;
    const s = detailJob.status.toLowerCase();
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => copyJobId(detailJob.job_id)}>Copy Job ID</Button>
        {STATUS_RETRYABLE.has(s) && (
          <Button size="sm" onClick={() => { setDetailJob(null); setConfirmAction({ action: "retry", jobIds: [detailJob.job_id], label: "Retry this job?" }); }}>Retry</Button>
        )}
        {STATUS_CANCELLABLE.has(s) && (
          <Button size="sm" onClick={() => { setDetailJob(null); setConfirmAction({ action: "cancel", jobIds: [detailJob.job_id], label: "Cancel this job?" }); }}>Cancel</Button>
        )}
        {isAdmin && STATUS_TERMINAL.has(s) && (
          <Button size="sm" variant="destructive" onClick={() => { setDetailJob(null); setConfirmAction({ action: "delete", jobIds: [detailJob.job_id], label: "Delete this job?" }); }}>Delete</Button>
        )}
      </div>
    );
  }, [detailJob, isAdmin, copyJobId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Jobs</h1>
          </div>
          <p className="text-sm text-muted-foreground">Background jobs queue — auto-refreshes every 20s.</p>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void load()}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* PS-76 JW8 — Summary metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            <MetricCard label="Total Jobs" value={metrics.total} />
            <MetricCard label="Queue Depth" value={metrics.queued} />
            <MetricCard label="Active Jobs" value={metrics.active} />
            <MetricCard label="Failed (24h)" value={metrics.failed24h} trend={metrics.failed24h > 0 ? "up" : "flat"} />
          </div>

          {error ? <p role="alert" className="text-sm text-destructive mb-4">{error}</p> : null}

          {/* PS-76 JW7 — Filter chips + search */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap mb-4">
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
              <option value="">Filter by state</option>
              <option value="created">created</option>
              <option value="queued">queued</option>
              <option value="scheduled">scheduled</option>
              <option value="dispatched">dispatched</option>
              <option value="running">running</option>
              <option value="blocked">blocked</option>
              <option value="paused">paused</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
              <option value="retry_wait">retry_wait</option>
              <option value="timeout">timeout</option>
              <option value="timed_out">timed_out</option>
              <option value="dead_lettered">dead_lettered</option>
              <option value="ttl_expired">ttl_expired</option>
              <option value="archived">archived</option>
            </Select>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All types</option>
              {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            {isAdmin && actors.length > 0 && (
              <Select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Filter by actor"
              >
                <option value="">All actors</option>
                {actors.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            )}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-36"
              aria-label="Date from"
              title="Filter: created after"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-36"
              aria-label="Date to"
              title="Filter: created before"
            />
          </div>

          <p className="text-xs text-muted-foreground mb-2">Total Records: {filteredJobs.length}</p>
          <DataTable
            columns={columns}
            rows={filteredJobs}
            emptyMessage="No jobs match the current filters."
            getRowId={(row) => row.job_id}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectable
            selectionColumnPosition="end"
            bulkActions={bulkActions}
            onBulkAction={(action, selectedIds) => {
              if (action === "export") {
                exportJobs(selectedIds);
              } else {
                const labels: Record<string, string> = {
                  cancel: `Cancel ${selectedIds.length} job(s)?`,
                  retry: `Retry ${selectedIds.length} job(s)?`,
                  delete: `Delete ${selectedIds.length} job(s)? This cannot be undone.`,
                };
                setConfirmAction({ action, jobIds: selectedIds, label: labels[action] ?? action });
              }
            }}
            columnPickerEnabled
            tableId="chat-client-jobs"
          />
        </CardContent>
      </Card>

      {/* PS-76 JW4 — Job detail dialog with 7 tabs */}
      <EntityDialog
        open={detailJob !== null}
        onOpenChange={(open) => { if (!open) { setDetailJob(null); setDetailTab("Overview"); } }}
        title={`Job ${detailJob?.job_id.slice(0, 12) ?? ""}`}
        body={detailJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Job detail tabs">
              {(["Overview", "Parameters", "Input ref", "Result/Output", "Thinking", "Lifecycle log", "Raw"] as const).map((tab) => (
                <Button key={tab} type="button" size="sm" role="tab" aria-selected={detailTab === tab}
                  variant={detailTab === tab ? "default" : "secondary"}
                  onClick={() => setDetailTab(tab)}>{tab}</Button>
              ))}
            </div>
            {detailTab === "Overview" ? (
              <div role="tabpanel" className="grid gap-2 text-sm sm:grid-cols-2">
                {([
                  ["Job ID", detailJob.job_id], ["Type", detailJob.job_type], ["Status", detailJob.status],
                  ["Actor", `${(detailJob.payload as Record<string, unknown>)?.request_auth_identity ?? detailJob.user_id ?? "—"}`],
                  ["Created", detailJob.created_at], ["Started", detailJob.started_at ?? (detailJob.payload as Record<string, unknown>)?.started_at ?? "—"],
                  ["Updated", detailJob.updated_at], ["Completed", detailJob.finished_at ?? "—"],
                  ["Duration", formatDuration(detailJob)], ["Retry count", `${detailJob.attempt ?? 0}`],
                  ["Last error", `${(detailJob.payload as Record<string, unknown>)?.error ?? "—"}`],
                  ["Correlation ID", detailJob.correlation_id ?? "—"],
                ] as Array<[string, unknown]>).map(([label, value]) => (
                  <div key={label}><dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt><dd className="mt-1 break-all text-sm">{String(value ?? "—")}</dd></div>
                ))}
              </div>
            ) : null}
            {detailTab === "Parameters" ? <div role="tabpanel"><JsonBlock title="Parameters" value={detailJob.payload ?? {}} defaultCollapsed={false} /></div> : null}
            {detailTab === "Input ref" ? <div role="tabpanel"><JsonBlock title="Input ref" value={{ session_id: detailJob.session_id, correlation_id: detailJob.correlation_id }} defaultCollapsed={false} /></div> : null}
            {detailTab === "Result/Output" ? <div role="tabpanel"><JsonBlock title="Result/Output" value={{ status: detailJob.status, result_ref: detailJob.result_ref ?? null, result: (detailJob.payload as Record<string, unknown>)?.result ?? null }} defaultCollapsed={false} /></div> : null}
            {detailTab === "Thinking" ? <div role="tabpanel"><p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No agent thinking trace recorded for this job type.</p></div> : null}
            {detailTab === "Lifecycle log" ? <div role="tabpanel"><JsonBlock title="Lifecycle log" value={[
              { timestamp: detailJob.created_at, to_state: "created", actor: detailJob.user_id },
              ...(detailJob.started_at ? [{ timestamp: detailJob.started_at, to_state: "running", actor: detailJob.user_id }] : []),
              { timestamp: detailJob.updated_at, to_state: detailJob.status, actor: detailJob.user_id },
            ].filter(e => e.timestamp)} defaultCollapsed={false} /></div> : null}
            {detailTab === "Raw" ? <div role="tabpanel"><JsonBlock title="Raw" value={detailJob} defaultCollapsed={false} /></div> : null}
            {detailControls}
          </div>
        ) : null}
      />

      {/* Confirmation dialog */}
      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)} role="presentation">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{confirmAction.label}</h3>
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
        </div>
      ) : null}
    </div>
  );
}
