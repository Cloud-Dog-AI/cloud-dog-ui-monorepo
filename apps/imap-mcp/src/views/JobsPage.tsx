// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0

// @cloud-dog/app-imap-mcp — Jobs page (PS-76 v2 compliant).
// Covers: JW1-JW7, W28A-620 pagination, PS-30 DataTable, PS-77 sub-dialog.

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Badge,
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
  createDataTableActionColumn,
  formatSeconds,
  type BulkAction,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import type { JobQueueStatus, JobRecord, JsonRecord } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

// PS-75 v2 lifecycle state sets
const STATUS_CANCELLABLE = new Set(["created", "queued", "scheduled", "dispatched", "running", "blocked", "paused"]);
const STATUS_RETRYABLE = new Set(["failed", "cancelled", "timeout", "timed_out", "dead_lettered", "ttl_expired"]);
const STATUS_TERMINAL = new Set(["succeeded", "failed", "cancelled", "timeout", "timed_out", "dead_lettered", "ttl_expired", "archived"]);

type ConfirmAction = Readonly<{ action: "cancel" | "retry" | "delete"; jobIds: string[]; label: string }>;

function asRoles(payload: JsonRecord | null): Record<string, string[]> {
  const roles = payload?.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return {};
  return Object.fromEntries(
    Object.entries(roles as Record<string, unknown>).map(([name, permissions]) => [
      name.toLowerCase(),
      Array.isArray(permissions) ? permissions.map((p) => String(p).trim()).filter(Boolean) : [],
    ])
  );
}

function permissionsForRole(role: string, rolePolicies: Record<string, string[]>): Set<string> {
  const resolved = new Set<string>();
  const n = role.trim().toLowerCase();
  if (!n) return resolved;
  if (n === "admin") { resolved.add("*"); return resolved; }
  for (const p of rolePolicies[n] ?? []) resolved.add(p);
  if (n === "read_jobs" || n === "write_jobs") resolved.add(n);
  return resolved;
}

// JW3 — Status badge colour mapping
function statusPresentation(status: string): { variant: "default" | "secondary" | "destructive"; className?: string } {
  const v = status.trim().toLowerCase();
  if (v === "succeeded") return { variant: "default", className: "bg-emerald-600 text-white border-emerald-700" };
  if (v === "failed" || v === "dead_lettered") return { variant: "destructive" };
  if (v === "timeout" || v === "timed_out") return { variant: "destructive", className: "opacity-90" };
  if (v === "blocked" || v === "paused" || v === "retry_wait") return { variant: "secondary", className: "bg-amber-100 text-amber-900 border-amber-200" };
  if (v === "scheduled") return { variant: "secondary", className: "bg-sky-100 text-sky-800 border-sky-200" };
  if (v === "cancelled") return { variant: "secondary", className: "line-through opacity-80" };
  if (v === "ttl_expired") return { variant: "secondary", className: "text-destructive border-destructive/30" };
  if (v === "archived") return { variant: "secondary", className: "opacity-70" };
  return { variant: "secondary" };
}

// JW2 #9 / CX-170 — Duration via shared moment-format helper, NEVER raw seconds.
function formatDuration(job: JobRecord): string {
  const start = Date.parse(job.startedAtUtc || job.createdAtUtc);
  const end = Date.parse(job.finishedAtUtc || job.updatedAtUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  return formatSeconds(Math.round((end - start) / 1000));
}

export function JobsPage() {
  const location = useLocation();
  const { api, role } = useImapMcpState();
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [queueStatus, setQueueStatus] = React.useState<JobQueueStatus | null>(null);
  const [rolePolicies, setRolePolicies] = React.useState<Record<string, string[]>>({});
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [actorFilter, setActorFilter] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [selectedJob, setSelectedJob] = React.useState<JobRecord | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [detailTab, setDetailTab] = React.useState("overview");
  const [tableEpoch, setTableEpoch] = React.useState(0);

  const permissions = React.useMemo(() => permissionsForRole(role, rolePolicies), [role, rolePolicies]);
  const isAdmin = permissions.has("*");
  const canWriteJobs = isAdmin || permissions.has("write_jobs") || permissions.has("read_jobs");
  const canDeleteJobs = isAdmin;

  const load = React.useCallback(async () => {
    const requestedJobId = new URLSearchParams(location.search).get("job_id")?.trim() ?? "";
    if (!requestedJobId) setError("");
    const [jobsResult, queueResult, policyResult] = await Promise.all([
      api.listJobs(), api.getJobQueueStatus(), api.getRbacPolicies(),
    ]);
    if (!jobsResult.ok || !jobsResult.data) { setError(jobsResult.errorMessage || "Failed to load jobs."); return; }
    setJobs([...jobsResult.data].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)));
    if (queueResult.ok && queueResult.data) setQueueStatus(queueResult.data);
    if (policyResult.ok && policyResult.data) setRolePolicies(asRoles(policyResult.data));
  }, [api, location.search]);

  React.useEffect(() => { void load(); const t = window.setInterval(() => void load(), 20_000); return () => window.clearInterval(t); }, [load]);

  const openJobDetail = React.useCallback(async (jobId: string, tab = "overview", fallback?: JobRecord) => {
    setError("");
    setDetailTab(tab);
    const result = await api.getJob(jobId);
    if (result.ok && result.data) {
      setSelectedJob(result.data);
      return;
    }
    setSelectedJob(null);
    const statusCode = result.meta.status ? `${result.meta.status} ` : "";
    setError(`${statusCode}${result.errorMessage || result.errorCode || "Failed to load job detail."}`.trim());
    if (fallback && result.meta.status !== 403) {
      setSelectedJob(fallback);
    }
  }, [api]);

  const requestedJobIdRef = React.useRef("");
  React.useEffect(() => {
    const jobId = new URLSearchParams(location.search).get("job_id")?.trim() ?? "";
    if (!jobId || requestedJobIdRef.current === jobId) return;
    requestedJobIdRef.current = jobId;
    void openJobDetail(jobId);
  }, [location.search, openJobDetail]);

  const metrics = React.useMemo(() => {
    let active = 0, failed24h = 0;
    const dayMs = 86_400_000;
    for (const j of jobs) {
      const s = j.status.toLowerCase();
      if (s === "running" || s === "dispatched") active++;
      if (s === "failed" && Date.now() - Date.parse(j.createdAtUtc) < dayMs) failed24h++;
    }
    return { total: jobs.length, queueDepth: Number(queueStatus?.counts.queued ?? 0), active, failed24h };
  }, [jobs, queueStatus]);

  const typeOptions = React.useMemo(
    () => [...new Set(jobs.map((j) => j.jobType).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  );
  const actorOptions = React.useMemo(
    () => [...new Set(jobs.map((j) => j.requestAuthIdentity || j.userId).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [jobs]
  );

  const filteredJobs = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTime = createdFrom ? Date.parse(`${createdFrom}T00:00:00Z`) : Number.NaN;
    const toTime = createdTo ? Date.parse(`${createdTo}T23:59:59.999Z`) : Number.NaN;
    return jobs.filter((j) => {
      if (statusFilter && j.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (typeFilter && j.jobType.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (actorFilter && (j.requestAuthIdentity || j.userId || "").toLowerCase() !== actorFilter.toLowerCase()) return false;
      if (Number.isFinite(fromTime) && Date.parse(j.createdAtUtc) < fromTime) return false;
      if (Number.isFinite(toTime) && Date.parse(j.createdAtUtc) > toTime) return false;
      if (q && j.jobId.toLowerCase() !== q) return false;
      return true;
    });
  }, [actorFilter, createdFrom, createdTo, jobs, query, statusFilter, typeFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [actorFilter, createdFrom, createdTo, query, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / Math.max(1, pageSize)));

  // IMAP-501: per-row job action helpers.
  const cancelJob = React.useCallback(async (jobId: string) => {
    if (!window.confirm(`Cancel job ${jobId}?`)) return;
    const r = await api.cancelJob(jobId);
    if (!r.ok) { setError(r.errorMessage || "Cancel failed."); return; }
    setStatus(`Cancelled job ${jobId}.`);
    await load();
  }, [api, load]);
  const retryJob = React.useCallback(async (jobId: string) => {
    if (!window.confirm(`Retry job ${jobId}?`)) return;
    const r = await api.retryJob(jobId);
    if (!r.ok) { setError(r.errorMessage || "Retry failed."); return; }
    setStatus(`Retried job ${jobId}.`);
    await load();
  }, [api, load]);
  const archiveJob = React.useCallback(async (jobId: string) => {
    if (!window.confirm(`Archive job ${jobId}?`)) return;
    const r = await api.archiveJob(jobId);
    if (!r.ok) { setError(r.errorMessage || "Archive failed."); return; }
    setStatus(`Archived job ${jobId}.`);
    await load();
  }, [api, load]);

  const performAction = React.useCallback(async (action: ConfirmAction["action"], jobIds: string[]) => {
    setBusy(true); setError(""); setStatus("");
    try {
      for (const id of jobIds) {
        const r = action === "cancel" ? await api.cancelJob(id) : action === "retry" ? await api.retryJob(id) : await api.deleteJob(id);
        if (!r.ok) throw new Error(r.errorMessage || `Failed ${action} ${id}`);
      }
      setStatus(`${action === "cancel" ? "Cancelled" : action === "retry" ? "Retried" : "Deleted"} ${jobIds.length} job(s).`);
      setConfirmAction(null);
      await load();
      setTableEpoch((value) => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }, [api, load]);

  // JW5 — Bulk actions
  const bulkActions = React.useMemo<BulkAction[]>(() => {
    const actions: BulkAction[] = [{ label: "Export", action: "export" }];
    if (canWriteJobs) {
      actions.push({ label: "Cancel Selected", action: "cancel" });
      actions.push({ label: "Retry Selected", action: "retry" });
    }
    if (canDeleteJobs) actions.push({ label: "Delete Selected", action: "delete" });
    return actions;
  }, [canDeleteJobs, canWriteJobs]);

  // JW2 — 12 mandatory columns in order
  const columns = React.useMemo<DataColumn<JobRecord>[]>(() => [
    {
      id: "job_id", header: "Job ID", sortable: true, sortValue: (r) => r.jobId,
      cell: (r) => (
        <Link
          to={`/jobs?job_id=${encodeURIComponent(r.jobId)}`}
          className="block max-w-[10rem] truncate font-mono text-xs text-primary underline-offset-4 hover:underline"
          title={r.jobId}
          onClick={(event) => {
            event.preventDefault();
            void openJobDetail(r.jobId, "overview", r);
          }}
        >
          {r.jobId.slice(0, 12)}
        </Link>
      ),
    },
    { id: "job_type", header: "Type", sortable: true, sortValue: (r) => r.jobType, cell: (r) => r.jobType || "—" },
    {
      id: "status", header: "Status", sortable: true, sortValue: (r) => r.status,
      cell: (r) => { const p = statusPresentation(r.status); return <Badge variant={p.variant} className={p.className}>{r.status}</Badge>; },
    },
    { id: "created_at", header: "Created", sortable: true, sortValue: (r) => r.createdAtUtc, cell: (r) => r.createdAtUtc ? <RelativeTime timestamp={r.createdAtUtc} /> : "—" },
    { id: "started_at", header: "Started", sortable: true, sortValue: (r) => r.startedAtUtc, cell: (r) => r.startedAtUtc ? <RelativeTime timestamp={r.startedAtUtc} /> : "—" },
    { id: "updated_at", header: "Updated", sortable: true, sortValue: (r) => r.updatedAtUtc, cell: (r) => r.updatedAtUtc ? <RelativeTime timestamp={r.updatedAtUtc} /> : "—" },
    { id: "completed_at", header: "Completed", sortable: true, sortValue: (r) => r.finishedAtUtc || "", cell: (r) => r.finishedAtUtc ? <RelativeTime timestamp={r.finishedAtUtc} /> : "—" },
    { id: "actor", header: "Actor", sortable: true, sortValue: (r) => r.requestAuthIdentity || r.userId || "", cell: (r) => r.requestAuthIdentity || r.userId || "—" },
    { id: "duration", header: "Duration", sortable: true, sortValue: (r) => { const s = Date.parse(r.startedAtUtc || r.createdAtUtc); const e = Date.parse(r.finishedAtUtc || r.updatedAtUtc); return Number.isFinite(s) && Number.isFinite(e) ? e - s : 0; }, cell: (r) => formatDuration(r) },
    { id: "result_link", header: "Result link", sortable: true, sortValue: (r) => r.result ? "1" : "0", cell: (r) => <Button variant="ghost" size="sm" className="!transition-none" title="View result" onClick={() => void openJobDetail(r.jobId, "result", r)}>📄</Button> },
    {
      id: "log_link",
      header: "Audit",
      sortable: true,
      sortValue: (r) => r.correlationId || r.jobId,
      // IMAP-173 / XC-006: log link navigates to the Audit & Log page
      // pre-filtered by this job's ID so the operator can see every audit
      // event for the job (creation, dispatch, errors, completion).
      cell: (r) => (
        <Link
          to={`/diagnostics-audit?job_id=${encodeURIComponent(r.jobId)}`}
          className="inline-flex h-8 items-center justify-center rounded-md px-2 text-sm hover:bg-accent"
          title={`View audit for job ${r.jobId}`}
        >
          📋
        </Link>
      ),
    },
    { id: "retry_count", header: "Retry count", sortable: true, sortValue: (r) => r.attempt || r.attempts || 0, cell: (r) => String(r.attempt || r.attempts || 0) },
    // Project-specific columns after mandatory 12
    { id: "profile_id", header: "Profile ID", sortable: true, sortValue: (r) => r.profileId || "", cell: (r) => r.profileId || "—" },
    { id: "mailbox", header: "Mailbox", sortable: true, sortValue: (r) => r.mailbox || "", cell: (r) => r.mailbox || "—" },
    {
      ...createDataTableActionColumn<JobRecord>((r) => {
        const status = String(r.status || "").toLowerCase();
        const isTerminal = ["succeeded", "failed", "cancelled", "timeout", "timed_out", "dead_lettered", "ttl_expired", "archived"].includes(status);
        const actions = [
          { id: "view", label: "View", onClick: () => void openJobDetail(r.jobId, "overview", r) },
          { id: "audit", label: "Audit", href: () => `/diagnostics-audit?job_id=${encodeURIComponent(r.jobId)}` },
        ];
        if (!isTerminal) {
          actions.push({ id: "cancel", label: "Cancel", onClick: () => void cancelJob(r.jobId) });
        }
        if (status === "failed" || status === "cancelled" || status === "timeout" || status === "timed_out" || status === "dead_lettered") {
          actions.push({ id: "retry", label: "Retry", onClick: () => void retryJob(r.jobId) });
        }
        if (isTerminal && status !== "archived") {
          actions.push({ id: "archive", label: "Archive", onClick: () => void archiveJob(r.jobId) });
        }
        return actions;
      }),
    },
  ], [openJobDetail, cancelJob, retryJob, archiveJob]);

  // JW4 — Detail dialog with 7 mandatory tabs
  const detailTabs = ["overview", "parameters", "input", "result", "thinking", "lifecycle", "raw"];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest text-primary">PS-76</p>
              <h1 className="text-xl font-semibold">Jobs</h1>
              <p className="text-sm text-muted-foreground">Background IMAP jobs with PS-76 v2 standard columns, lifecycle badges, and queue metrics.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Total Jobs" value={metrics.total} />
            <MetricCard label="Queue Depth" value={metrics.queueDepth} />
            <MetricCard label="Active" value={metrics.active} />
            <MetricCard label="Failed (24h)" value={metrics.failed24h} />
          </div>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

          {/* JW7 — Filter / Search / Sort / Pagination */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Input placeholder="Exact Job ID" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" aria-label="Exact Job ID search" />
            <Select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {["created", "queued", "scheduled", "dispatched", "running", "retry_wait", "blocked", "paused", "succeeded", "failed", "cancelled", "timeout", "timed_out", "dead_lettered", "ttl_expired", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select aria-label="Type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {typeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            {isAdmin ? (
              <Select aria-label="Actor filter" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
                <option value="">All actors</option>
                {actorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            ) : null}
            <Input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} aria-label="Created from date" className="max-w-[11rem]" />
            <Input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} aria-label="Created to date" className="max-w-[11rem]" />
            <span className="text-sm text-muted-foreground">Total Records: {filteredJobs.length}</span>
            <span className="text-sm text-muted-foreground">Page {Math.min(page, totalPages)} of {totalPages}</span>
          </div>

          <DataTable
            key={tableEpoch}
            columns={columns}
            rows={filteredJobs}
            emptyMessage="No jobs found."
            getRowId={(r) => r.jobId}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectable
            bulkActions={bulkActions}
            onBulkAction={(action, selectedIds) => {
              const ids = selectedIds as string[];
              if (action === "export") {
                const selected = filteredJobs.filter((job) => ids.includes(job.jobId));
                const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `jobs-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }
              else if (action === "cancel") setConfirmAction({ action: "cancel", jobIds: ids, label: `Cancel ${ids.length} job(s)?` });
              else if (action === "retry") setConfirmAction({ action: "retry", jobIds: ids, label: `Retry ${ids.length} job(s)?` });
              else if (action === "delete") setConfirmAction({ action: "delete", jobIds: ids, label: `Delete ${ids.length} job(s)? This cannot be undone.` });
            }}
            columnPickerEnabled
            tableId="imap-jobs"
          />
        </CardContent>
      </Card>

      {/* JW4 — Detail dialog with 7 mandatory tabs */}
      {selectedJob ? (
        <EntityDialog
          open
          onOpenChange={(open) => { if (!open) setSelectedJob(null); }}
          title={`Job ${selectedJob.jobId.slice(0, 12)}`}
          body={
            <div className="space-y-4">
              <div className="flex gap-1 flex-wrap border-b pb-2">
                {detailTabs.map((tab) => (
                  <Button key={tab} variant={detailTab === tab ? "default" : "ghost"} size="sm" onClick={() => setDetailTab(tab)}>
                    {tab === "overview" ? "Overview" : tab === "parameters" ? "Parameters" : tab === "input" ? "Input ref" : tab === "result" ? "Result/Output" : tab === "thinking" ? "Thinking" : tab === "lifecycle" ? "Lifecycle log" : "Raw"}
                  </Button>
                ))}
              </div>
              {detailTab === "overview" ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-semibold">Job ID:</span> {selectedJob.jobId}</div>
                  <div><span className="font-semibold">Type:</span> {selectedJob.jobType}</div>
                  <div><span className="font-semibold">Status:</span> <Badge variant={statusPresentation(selectedJob.status).variant} className={statusPresentation(selectedJob.status).className}>{selectedJob.status}</Badge></div>
                  <div><span className="font-semibold">Actor:</span> {selectedJob.requestAuthIdentity || selectedJob.userId || "—"}</div>
                  <div><span className="font-semibold">Created:</span> {selectedJob.createdAtUtc || "—"}</div>
                  <div><span className="font-semibold">Started:</span> {selectedJob.startedAtUtc || "—"}</div>
                  <div><span className="font-semibold">Updated:</span> {selectedJob.updatedAtUtc || "—"}</div>
                  <div><span className="font-semibold">Completed:</span> {selectedJob.finishedAtUtc || "—"}</div>
                  <div><span className="font-semibold">Duration:</span> {formatDuration(selectedJob)}</div>
                  <div><span className="font-semibold">Retry count:</span> {selectedJob.attempt || selectedJob.attempts || 0}</div>
                  <div><span className="font-semibold">Last error:</span> {selectedJob.lastError || "—"}</div>
                  <div><span className="font-semibold">Correlation ID:</span> {selectedJob.correlationId || "—"}</div>
                  <div><span className="font-semibold">Trace ID:</span> {selectedJob.traceId || "—"}</div>
                </div>
              ) : null}
              {detailTab === "parameters" ? <JsonBlock title="Parameters" value={selectedJob.payload ?? {}} defaultCollapsed={false} /> : null}
              {detailTab === "input" ? <JsonBlock title="Input ref" value={selectedJob.payload ?? {}} defaultCollapsed={false} /> : null}
              {detailTab === "result" ? <JsonBlock title="Result/Output" value={selectedJob.result ?? {}} defaultCollapsed={false} /> : null}
              {detailTab === "thinking" ? <p className="text-sm text-muted-foreground italic">Thinking data not available for IMAP jobs.</p> : null}
              {detailTab === "lifecycle" ? (
                <div className="text-sm space-y-1">
                  <p><span className="font-semibold">Created:</span> {selectedJob.createdAtUtc}</p>
                  {selectedJob.startedAtUtc ? <p><span className="font-semibold">Started:</span> {selectedJob.startedAtUtc}</p> : null}
                  {selectedJob.updatedAtUtc ? <p><span className="font-semibold">Updated:</span> {selectedJob.updatedAtUtc}</p> : null}
                  {selectedJob.finishedAtUtc ? <p><span className="font-semibold">Completed:</span> {selectedJob.finishedAtUtc}</p> : null}
                  {selectedJob.lastError ? <p><span className="font-semibold text-destructive">Error:</span> {selectedJob.lastError}</p> : null}
                </div>
              ) : null}
              {detailTab === "raw" ? <JsonBlock title="Raw job record" value={selectedJob as unknown as Record<string, unknown>} defaultCollapsed={false} /> : null}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(selectedJob.jobId)}>Copy Job ID</Button>
                <Button variant="ghost" size="sm" disabled={!canWriteJobs || !STATUS_RETRYABLE.has(selectedJob.status.toLowerCase())} onClick={() => setConfirmAction({ action: "retry", jobIds: [selectedJob.jobId], label: "Retry this job?" })}>Retry</Button>
                <Button variant="ghost" size="sm" disabled={!canWriteJobs || !STATUS_CANCELLABLE.has(selectedJob.status.toLowerCase())} onClick={() => setConfirmAction({ action: "cancel", jobIds: [selectedJob.jobId], label: "Cancel this job?" })}>Cancel</Button>
                {canDeleteJobs ? <Button variant="destructive" size="sm" disabled={!STATUS_TERMINAL.has(selectedJob.status.toLowerCase())} onClick={() => setConfirmAction({ action: "delete", jobIds: [selectedJob.jobId], label: "Delete this job?" })}>Delete</Button> : null}
              </div>
            </div>
          }
        />
      ) : null}

      {/* Confirmation modal */}
      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{confirmAction.label}</h2>
            <p className="text-sm text-muted-foreground mt-2">This will apply to {confirmAction.jobIds.length} job(s).</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={busy}>Cancel</Button>
              <Button variant={confirmAction.action === "delete" ? "destructive" : "default"} onClick={() => void performAction(confirmAction.action, confirmAction.jobIds)} disabled={busy}>Confirm</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
