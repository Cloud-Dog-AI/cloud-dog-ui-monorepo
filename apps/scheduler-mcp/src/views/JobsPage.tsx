// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-1 — Jobs PS-76 Phase 4 (full implementation).
//
// PS-76 standard job-control view over the scheduler run model (/v1/runs). A
// "job" here is a schedule run (ScheduleRunDto). Delivers: DataTable pagination
// (10/25/50/100), sort/filter/search, dead-letter visibility, a 7-tab detail
// dialog (PS-76 §D), Copy/Retry/Cancel/Delete row actions, bulk Cancel/Retry/
// Delete with confirmation, Escape-to-close, and scope-aware action gating
// (F-1408-3). Consumes the W28K-1407 + W28K-1408 backend run endpoints.

import * as React from "react";
import {
  Button,
  DataTable,
  Dialog,
  Input,
  JsonBlock,
  MetricCard,
  RelativeTime,
  Select,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BulkAction,
  type DataColumn,
} from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { ErrorBanner, PageHeader } from "../lib/ui";
import { SCOPES } from "../lib/rbac";
import { DEAD_LETTER, canCancelStatus, canDeleteStatus, canRetryStatus, normStatus as norm } from "../lib/run-status";
import type { ScheduleRunDto } from "../lib/types";

type DetailTab = "overview" | "parameters" | "input" | "result" | "thinking" | "lifecycle" | "raw";

type PendingAction = Readonly<{
  action: "cancel" | "retry" | "delete";
  ids: string[];
  label: string;
}>;

function canCancel(r: ScheduleRunDto): boolean {
  return canCancelStatus(r.status);
}
function canRetry(r: ScheduleRunDto): boolean {
  return canRetryStatus(r.status);
}
function canDelete(r: ScheduleRunDto): boolean {
  return canDeleteStatus(r.status);
}

function tsSort(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function asDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function lifecycle(r: ScheduleRunDto): Array<{ state: string; at: string | null }> {
  return [
    { state: "scheduled_for", at: r.scheduled_for },
    { state: "started_at", at: r.started_at },
    { state: "finished_at", at: r.finished_at },
  ].filter((e) => e.at);
}

function selectedOptions(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.currentTarget.selectedOptions).map((o) => o.value);
}

export function JobsPage() {
  const { api, can } = useAppState();
  const canRunNow = can(SCOPES.runNow);
  const canWrite = can(SCOPES.write);
  const isAdmin = can(SCOPES.admin);

  const [runs, setRuns] = React.useState<ScheduleRunDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ScheduleRunDto | null>(null);
  const [activeTab, setActiveTab] = React.useState<DetailTab>("overview");
  const [pending, setPending] = React.useState<PendingAction | null>(null);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [idQuery, setIdQuery] = React.useState("");
  const [scheduleQuery, setScheduleQuery] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [deadLetterOnly, setDeadLetterOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listRuns({ limit: 200, dead_letter: deadLetterOnly || undefined });
      const items = Array.isArray(r?.items) ? [...r.items] : [];
      items.sort((a, b) => tsSort(b.scheduled_for).localeCompare(tsSort(a.scheduled_for)));
      setRuns(items);
      setSelected((cur) => (cur ? items.find((x) => x.schedule_run_id === cur.schedule_run_id) ?? cur : cur));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [api, deadLetterOnly]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { setPage(1); }, [idQuery, scheduleQuery, statusFilters, startDate, endDate, deadLetterOnly, runs.length]);

  // Escape closes the detail dialog (PS-76 keyboard contract).
  React.useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selected]);

  const statusOptions = React.useMemo(
    () => Array.from(new Set(runs.map((r) => norm(r.status)).filter(Boolean))).sort(),
    [runs],
  );

  const filtered = React.useMemo(() => {
    const exactId = idQuery.trim();
    const sched = scheduleQuery.trim();
    return runs.filter((r) => {
      if (exactId && r.schedule_run_id !== exactId) return false;
      if (sched && r.schedule_id !== sched) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(norm(r.status))) return false;
      if (startDate || endDate) {
        const d = asDate(r.scheduled_for);
        if (!d) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
      }
      return true;
    });
  }, [runs, idQuery, scheduleQuery, statusFilters, startDate, endDate]);

  const metrics = React.useMemo(() => ({
    total: runs.length,
    active: runs.filter((r) => ["scheduled", "claimed", "queued", "running"].includes(norm(r.status))).length,
    failed: runs.filter((r) => ["failed", "misfired", "partially_failed"].includes(norm(r.status))).length,
    deadLetter: runs.filter((r) => DEAD_LETTER.has(norm(r.status))).length,
  }), [runs]);

  const openDetail = React.useCallback(async (run: ScheduleRunDto, tab: DetailTab = "overview") => {
    setActiveTab(tab);
    try {
      const detail = await api.getRun(run.schedule_run_id);
      setSelected(detail);
    } catch {
      setSelected(run);
    }
  }, [api]);

  const copyId = React.useCallback(async () => {
    if (!selected) return;
    const id = selected.schedule_run_id;
    try { await navigator.clipboard.writeText(id); setStatus(`Copied run ${id}.`); }
    catch { setStatus(`Run ID ${id}`); }
  }, [selected]);

  // W28K-1409 F-1409-6 — download the run report PDF (run summary + step trace +
  // audit lifecycle). Read-gated: anyone who can view the run may export it.
  const downloadReport = React.useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      await api.downloadRunReport(selected.schedule_run_id);
      setStatus(`Report PDF for run ${selected.schedule_run_id} downloaded.`);
    } catch (e: any) { setError(e?.message ?? String(e)); }
  }, [api, selected]);

  const clearFilters = React.useCallback(() => {
    setIdQuery(""); setScheduleQuery(""); setStatusFilters([]); setStartDate(""); setEndDate(""); setDeadLetterOnly(false);
  }, []);

  const perform = React.useCallback(async (action: PendingAction["action"], ids: string[]) => {
    setError(null);
    let changed = 0;
    const targets = runs.filter((r) => ids.includes(r.schedule_run_id));
    for (const r of targets) {
      try {
        if (action === "cancel" && canCancel(r) && canWrite) { await api.cancelRun(r.schedule_run_id); changed += 1; }
        else if (action === "retry" && canRetry(r) && canRunNow) { await api.retryRun(r.schedule_run_id); changed += 1; }
        else if (action === "delete" && canDelete(r) && isAdmin) { await api.deleteRun(r.schedule_run_id); changed += 1; }
      } catch (e: any) {
        setError(`${action} failed for run ${r.schedule_run_id}: ${e?.message ?? String(e)}`);
        break;
      }
    }
    setPending(null);
    if (action === "delete" && targets.some((r) => r.schedule_run_id === selected?.schedule_run_id)) setSelected(null);
    setStatus(changed > 0 ? `${action} succeeded for ${changed} run(s).` : `No eligible runs for ${action}.`);
    await load();
  }, [api, canCancel, canDelete, canRetry, canRunNow, canWrite, isAdmin, runs, load, selected]);

  const columns = React.useMemo<DataColumn<ScheduleRunDto>[]>(() => [
    {
      id: "run", header: "Run ID",
      cell: (r) => (
        <button type="button" className="font-mono text-xs text-foreground hover:underline" data-testid={`job-open-${r.schedule_run_id}`} onClick={() => void openDetail(r)}>
          {r.schedule_run_id}
        </button>
      ),
      sortable: true, sortValue: (r) => r.schedule_run_id,
    },
    { id: "schedule", header: "Schedule", cell: (r) => <code className="text-xs">{r.schedule_id}</code>, sortable: true, sortValue: (r) => r.schedule_id },
    { id: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} />, sortable: true, sortValue: (r) => norm(r.status) },
    { id: "trigger", header: "Trigger", cell: (r) => <code className="text-xs">{r.trigger_type ?? "—"}</code>, sortable: true, sortValue: (r) => String(r.trigger_type ?? "") },
    { id: "scheduled", header: "Scheduled", cell: (r) => (r.scheduled_for ? <RelativeTime timestamp={r.scheduled_for} /> : "—"), sortable: true, sortValue: (r) => tsSort(r.scheduled_for) },
    { id: "started", header: "Started", cell: (r) => (r.started_at ? <RelativeTime timestamp={r.started_at} /> : "—"), sortable: true, sortValue: (r) => tsSort(r.started_at) },
    { id: "finished", header: "Finished", cell: (r) => (r.finished_at ? <RelativeTime timestamp={r.finished_at} /> : "—"), sortable: true, sortValue: (r) => tsSort(r.finished_at) },
    { id: "attempt", header: "Attempt", cell: (r) => r.attempt, sortable: true, sortValue: (r) => r.attempt },
    { id: "error", header: "Error", cell: (r) => (r.error_code ? <span className="text-xs text-red-700">{r.error_code}</span> : "—"), sortable: true, sortValue: (r) => String(r.error_code ?? "") },
    {
      id: "result", header: "Result",
      cell: (r) => (
        <a href={`/system/jobs?run=${r.schedule_run_id}`} className="text-sm text-primary hover:underline" data-testid={`job-result-${r.schedule_run_id}`}
           onClick={(e) => { e.preventDefault(); void openDetail(r, "result"); }}>
          Result
        </a>
      ),
      sortable: true, sortValue: (r) => String(r.result_ref ?? ""),
    },
  ], [openDetail]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    ...(canWrite ? [{ label: "Cancel Selected", action: "cancel" }] : []),
    ...(canRunNow ? [{ label: "Retry Selected", action: "retry" }] : []),
    ...(isAdmin ? [{ label: "Delete Selected", action: "delete" }] : []),
  ], [canWrite, canRunNow, isAdmin]);

  return (
    <div data-testid="scheduler-jobs-page" className="space-y-6 p-6">
      <PageHeader
        title="Jobs"
        description="Schedule-run job control (PS-76 standard job-control view)"
        actions={<Button onClick={() => void load()} data-testid="jobs-refresh">Refresh</Button>}
      />
      <ErrorBanner error={error} />
      {status ? <p role="status" className="text-sm text-muted-foreground" data-testid="jobs-status">{status}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Runs" value={String(metrics.total)} />
        <MetricCard label="Active" value={String(metrics.active)} />
        <MetricCard label="Failed" value={String(metrics.failed)} />
        <MetricCard label="Dead-letter" value={String(metrics.deadLetter)} />
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-medium">Run ID search</span>
            <Input value={idQuery} onChange={(e) => setIdQuery(e.target.value)} placeholder="Exact run ID" aria-label="Run ID search" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Schedule ID</span>
            <Input value={scheduleQuery} onChange={(e) => setScheduleQuery(e.target.value)} placeholder="Exact schedule ID" aria-label="Schedule ID filter" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Status filter</span>
            <Select multiple className="min-h-20" value={statusFilters} onChange={(e) => setStatusFilters(selectedOptions(e))} aria-label="Status filter">
              {statusOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Start date</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">End date</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => void load()} data-testid="jobs-refresh-2">Refresh jobs</Button>
          <Button type="button" variant="secondary" onClick={clearFilters} data-testid="jobs-clear-filters">Clear filters</Button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deadLetterOnly} onChange={(e) => setDeadLetterOnly(e.target.checked)} data-testid="jobs-deadletter-toggle" aria-label="Dead-letter only" />
            Dead-letter only
          </label>
          <p className="ml-auto text-sm text-muted-foreground" data-testid="jobs-record-count">
            Total Records: {filtered.length} — Page {page} of {Math.max(1, Math.ceil(filtered.length / pageSize))}
          </p>
        </div>

        {loading ? (
          <div role="status">Loading...</div>
        ) : (
          <DataTable<ScheduleRunDto>
            columns={columns}
            rows={filtered}
            totalRows={filtered.length}
            emptyMessage="No runs found."
            getRowId={(r) => r.schedule_run_id}
            getRowName={(r) => `Run ${r.schedule_run_id} ${norm(r.status)}`}
            getSelectionLabel={(r) => `Select run ${r.schedule_run_id}`}
            getRowTestId={(r) => `job-row-${r.schedule_run_id}`}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectable={bulkActions.length > 0}
            selectionColumnPosition="start"
            bulkActions={bulkActions}
            onBulkAction={(action, ids) => {
              const labels: Record<string, string> = {
                cancel: `Cancel ${ids.length} selected run(s)?`,
                retry: `Retry ${ids.length} selected run(s)?`,
                delete: `Delete ${ids.length} selected run(s)?`,
              };
              setPending({ action: action as PendingAction["action"], ids, label: labels[action] ?? action });
            }}
            columnPickerEnabled
            tableId="scheduler-jobs-w28k-1408"
          />
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={(o) => { if (!o) setSelected(null); }} label="Run detail dialog">
        {selected ? (
          <div className="space-y-4" data-testid="job-detail">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Run {selected.schedule_run_id} detail</h2>
                <p className="text-sm text-muted-foreground">{selected.schedule_id} — {norm(selected.status)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" data-testid="job-copy-id" onClick={() => void copyId()}>Copy Run ID</Button>
                <Button type="button" variant="secondary" size="sm" data-testid="job-report-pdf" onClick={() => void downloadReport()}>Download PDF</Button>
                {canRunNow ? (
                  <Button type="button" variant="secondary" size="sm" data-testid="job-retry" disabled={!canRetry(selected)}
                    onClick={() => setPending({ action: "retry", ids: [selected.schedule_run_id], label: `Retry run ${selected.schedule_run_id}?` })}>Retry</Button>
                ) : null}
                {canWrite ? (
                  <Button type="button" variant="secondary" size="sm" data-testid="job-cancel" disabled={!canCancel(selected)}
                    onClick={() => setPending({ action: "cancel", ids: [selected.schedule_run_id], label: `Cancel run ${selected.schedule_run_id}?` })}>Cancel</Button>
                ) : null}
                {isAdmin ? (
                  <Button type="button" variant="destructive" size="sm" data-testid="job-delete" disabled={!canDelete(selected)}
                    onClick={() => setPending({ action: "delete", ids: [selected.schedule_run_id], label: `Delete run ${selected.schedule_run_id}?` })}>Delete</Button>
                ) : null}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="parameters">Parameters</TabsTrigger>
                <TabsTrigger value="input">Input ref</TabsTrigger>
                <TabsTrigger value="result">Result/Output</TabsTrigger>
                <TabsTrigger value="thinking">Diagnostics</TabsTrigger>
                <TabsTrigger value="lifecycle">Lifecycle log</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div><dt className="font-medium">Status</dt><dd><StatusBadge value={selected.status} /></dd></div>
                  <div><dt className="font-medium">Schedule</dt><dd className="font-mono text-xs">{selected.schedule_id}</dd></div>
                  <div><dt className="font-medium">Trigger</dt><dd>{selected.trigger_type ?? "—"}</dd></div>
                  <div><dt className="font-medium">Attempt</dt><dd>{selected.attempt}</dd></div>
                  <div><dt className="font-medium">Scheduled</dt><dd>{selected.scheduled_for ?? "—"}</dd></div>
                  <div><dt className="font-medium">Started</dt><dd>{selected.started_at ?? "—"}</dd></div>
                  <div><dt className="font-medium">Finished</dt><dd>{selected.finished_at ?? "—"}</dd></div>
                  <div><dt className="font-medium">Error code</dt><dd>{selected.error_code ?? "—"}</dd></div>
                </dl>
              </TabsContent>
              <TabsContent value="parameters">
                <JsonBlock title="Trigger lineage" value={{ trigger_type: selected.trigger_type, trigger_source_id: selected.trigger_source_id, attempt: selected.attempt }} defaultCollapsed={false} copyAriaLabel="Copy trigger lineage JSON" />
              </TabsContent>
              <TabsContent value="input">
                <JsonBlock title="Input ref" value={{ schedule_id: selected.schedule_id, scheduled_for: selected.scheduled_for, chain_run_id: selected.chain_run_id, root_job_id: selected.root_job_id }} defaultCollapsed={false} copyAriaLabel="Copy input ref JSON" />
              </TabsContent>
              <TabsContent value="result">
                <JsonBlock title="Result/Output" value={{ result_ref: selected.result_ref ?? null, error_code: selected.error_code, error_summary: selected.error_summary ?? null }} defaultCollapsed={false} copyAriaLabel="Copy result JSON" />
              </TabsContent>
              <TabsContent value="thinking">
                <JsonBlock title="Diagnostics" value={{ error_code: selected.error_code, error_summary: selected.error_summary ?? null }} defaultCollapsed={false} copyAriaLabel="Copy diagnostics JSON" />
              </TabsContent>
              <TabsContent value="lifecycle">
                <JsonBlock title="Lifecycle log" value={lifecycle(selected)} defaultCollapsed={false} copyAriaLabel="Copy lifecycle JSON" />
              </TabsContent>
              <TabsContent value="raw">
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/20 p-3 text-xs font-mono">{JSON.stringify(selected, null, 2)}</pre>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }} label="Confirm run action">
        {pending ? (
          <div className="space-y-4" data-testid="job-confirm">
            <h2 className="text-lg font-semibold">{pending.label}</h2>
            <p className="text-sm text-muted-foreground">
              {pending.action === "delete" ? "This permanently removes eligible terminal/blocked run records." : "This changes eligible run state."}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" data-testid="job-confirm-cancel" onClick={() => setPending(null)}>Close</Button>
              <Button type="button" variant={pending.action === "delete" ? "destructive" : "default"} data-testid="job-confirm-ok" onClick={() => void perform(pending.action, pending.ids)}>Confirm</Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
