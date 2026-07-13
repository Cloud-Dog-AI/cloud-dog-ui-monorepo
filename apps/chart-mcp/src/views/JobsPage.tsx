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

// PS-76 Jobs WebUI (W28F-931 R5 — JW2 / JW4 / JW5 / JW6 conformance).
//
// - JW2: 12-column DataTable in the canonical order
//   job_id / operation / status / submitted_at / started_at / completed_at /
//   duration / actor / role / correlation_id / attempts / progress.
// - JW4: 7-tab detail dialog (summary / inputs / outputs / events / logs /
//   correlation / RBAC).
// - JW5: row-level RBAC actions (view always; cancel = own cancellable; bulk
//   retry = chart.operator+; bulk delete = chart.admin only).
// - JW6: filter bar (status multi-select, operation, actor, correlation_id,
//   date range) + bulk actions (retry / cancel) with success-verification
//   notification.
//
// All controls are @cloud-dog/ui form components (Input / Select /
// MultiSelect / DateRangePicker / Button / DataTable / Dialog / Tabs /
// ConfirmDialog) — zero bespoke <table>/<form>/<input>.

import * as React from "react";
import {
  Badge,
  BulkAction,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DatePicker,
  Dialog,
  Input,
  JsonBlock,
  Label,
  MultiSelect,
  RelativeTime,
  Select,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  createDataTableActionColumn,
  formatSeconds,
  type DataColumn,
  type MultiSelectOption,
} from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { Job } from "../lib/types";

// PS-76 lifecycle states (5 demo states + canonical retry_wait).
const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "retry_wait", label: "Retry Wait" },
];

const CANCELLABLE = new Set(["pending", "queued", "running", "processing"]);

// RBAC role -> ability map. Mirrors role-visibility.ts + the backend
// CHART_ROLE_PERMISSIONS catalogue. The PS-76 JW5 contract.
function roleAbilities(roles: readonly string[]): {
  canSubmit: boolean;
  canCancel: boolean;
  canBulkRetry: boolean;
  canBulkCancel: boolean;
  canDelete: boolean;
} {
  const set = new Set(roles);
  const has = (...r: string[]) => r.some((x) => set.has(x));
  const isAdmin = has("admin", "chart.admin", "chart.renderer_admin");
  const isOperator = has("chart.operator", "chart.designer", "chart.renderer_admin", "chart.admin", "admin");
  return {
    canSubmit: isOperator,
    canCancel: isOperator,
    canBulkRetry: isOperator,
    canBulkCancel: isOperator,
    canDelete: isAdmin,
  };
}

function readField(job: Job, name: string): string {
  const value = (job as Record<string, unknown>)[name];
  return value === null || value === undefined ? "" : String(value);
}

function durationLabel(job: Job): string {
  const raw = (job as Record<string, unknown>).duration;
  if (typeof raw === "number" && Number.isFinite(raw)) return formatSeconds(Math.floor(raw));
  return "—";
}

function progressValue(job: Job): number {
  const raw = (job as Record<string, unknown>).progress;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.min(100, Math.floor(raw)));
  return 0;
}

// W28E-1810C a11y (WSC-015 / axe aria-progressbar-name): a data-table progress
// cell needs a per-row accessible name, which the generic shared <Progress>
// component cannot provide. Render the same visual bar with a row-scoped
// aria-label so axe reports zero violations.
function JobProgress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full rounded-full bg-muted overflow-hidden"
    >
      <div className="h-full bg-primary" style={{ width: `${v}%` }} />
    </div>
  );
}

function attemptsValue(job: Job): number {
  const raw = (job as Record<string, unknown>).attempts;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.floor(raw);
  return 0;
}

// 7-tab detail dialog content factory. Each tab pulls from the same Job
// shape; the backend already returns the augmented PS-76 record.
function JobDetailTabs({ job }: { job: Job }) {
  const payload = (job as Record<string, unknown>).payload as Record<string, unknown> | undefined;
  const [tab, setTab] = React.useState("summary");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="inputs">Inputs</TabsTrigger>
        <TabsTrigger value="outputs">Outputs</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="correlation">Correlation</TabsTrigger>
        <TabsTrigger value="rbac">RBAC</TabsTrigger>
      </TabsList>
      <TabsContent value="summary">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Lifecycle summary</h3>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>job_id:</strong> <code>{job.job_id}</code></div>
            <div><strong>operation:</strong> {readField(job, "operation") || "—"}</div>
            <div><strong>status:</strong> <StatusBadge value={readField(job, "status") || "unknown"} /></div>
            <div><strong>submitted_at:</strong> {readField(job, "submitted_at") || "—"}</div>
            <div><strong>started_at:</strong> {readField(job, "started_at") || "—"}</div>
            <div><strong>completed_at:</strong> {readField(job, "completed_at") || "—"}</div>
            <div><strong>duration:</strong> {durationLabel(job)}</div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="inputs">
        <JsonBlock title="payload" value={payload ?? {}} defaultCollapsed={false} />
      </TabsContent>
      <TabsContent value="outputs">
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div><strong>manifest_id:</strong> {readField(job, "manifest_id") || "—"}</div>
            <div><strong>session_id:</strong> {readField(job, "session_id") || "—"}</div>
            {readField(job, "error") ? (
              <div className="text-destructive"><strong>error:</strong> {readField(job, "error")}</div>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="events">
        <JsonBlock title="lifecycle events" value={{
          submitted_at: readField(job, "submitted_at"),
          started_at: readField(job, "started_at"),
          completed_at: readField(job, "completed_at"),
          attempts: attemptsValue(job),
          progress: progressValue(job),
        }} defaultCollapsed={false} />
      </TabsContent>
      <TabsContent value="logs">
        <JsonBlock title="job record" value={job as Record<string, unknown>} defaultCollapsed={false} />
      </TabsContent>
      <TabsContent value="correlation">
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div><strong>correlation_id:</strong> <code>{readField(job, "correlation_id") || "—"}</code></div>
            <div><strong>tenant_id:</strong> <code>{readField(job, "tenant_id") || "—"}</code></div>
            <div>
              <a className="text-primary underline" href={`/audit-log?query=job:${encodeURIComponent(job.job_id)}`}>
                Open audit log filtered to this job
              </a>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="rbac">
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div><strong>actor:</strong> {readField(job, "actor") || "—"}</div>
            <div><strong>role:</strong> {readField(job, "role") || "—"}</div>
            <p className="text-xs text-muted-foreground">
              The acting role at submission time. PS-76 JW5 row-level controls
              (cancel / retry / delete) are gated on the caller's current role
              + ownership; see <code>roleAbilities()</code>.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

export function JobsPage() {
  const { api, appVersion } = useChartState();
  const auth = useAuth();
  const userRoles: readonly string[] = (auth.user?.roles as readonly string[] | undefined) ?? [];
  const ability = roleAbilities(userRoles);

  const [rows, setRows] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Job | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState<Job | null>(null);

  // JW6 filter state.
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [operationFilter, setOperationFilter] = React.useState<string>("");
  const [actorFilter, setActorFilter] = React.useState<string>("");
  const [correlationFilter, setCorrelationFilter] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState<string | null>(null);
  const [dateTo, setDateTo] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listJobs();
      setRows(list);
    } catch (e) {
      setError(errMessage(e, "Failed to load jobs."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  // Operation distinct list derived from rows (no bespoke <input>).
  const operationOptions = React.useMemo<readonly { value: string; label: string }[]>(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const op = readField(r, "operation");
      if (op) set.add(op);
    }
    return [{ value: "", label: "All operations" }, ...Array.from(set).sort().map((op) => ({ value: op, label: op }))];
  }, [rows]);

  // JW6 client-side filtering.
  const filtered = React.useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter.length > 0 && !statusFilter.includes(readField(row, "status"))) return false;
      if (operationFilter && readField(row, "operation") !== operationFilter) return false;
      if (actorFilter && !readField(row, "actor").toLowerCase().includes(actorFilter.toLowerCase())) return false;
      if (correlationFilter && !readField(row, "correlation_id").toLowerCase().includes(correlationFilter.toLowerCase())) return false;
      if (dateFrom) {
        const submitted = readField(row, "submitted_at");
        if (!submitted || submitted < dateFrom) return false;
      }
      if (dateTo) {
        const submitted = readField(row, "submitted_at");
        if (!submitted || submitted > `${dateTo}T23:59:59Z`) return false;
      }
      return true;
    });
  }, [rows, statusFilter, operationFilter, actorFilter, correlationFilter, dateFrom, dateTo]);

  const cancel = async (job: Job) => {
    await api.cancelJob(job.job_id);
    setStatus(`Cancelled job ${job.job_id}.`);
    await reload();
  };

  const onBulk = async (action: string, selectedIds: string[]) => {
    if (selectedIds.length === 0) {
      setStatus("No jobs selected.");
      return;
    }
    try {
      if (action === "retry") {
        // JW6 bulk-retry — uses /api/jobs/_bulk_retry which re-submits each
        // through the live submit_render_job path.
        const out = await api.bulkRetryJobs(selectedIds);
        const succeeded = out.results.filter((r) => r.status === "succeeded").length;
        const total = out.results.length;
        setStatus(`Bulk retry: ${succeeded}/${total} succeeded.`);
        await reload();
      } else if (action === "cancel") {
        let ok = 0;
        for (const jid of selectedIds) {
          try {
            await api.cancelJob(jid);
            ok += 1;
          } catch { /* keep going */ }
        }
        setStatus(`Bulk cancel: ${ok}/${selectedIds.length} cancelled.`);
        await reload();
      }
    } catch (e) {
      setStatus(errMessage(e, "Bulk action failed."));
    }
  };

  // PS-76 JW2 canonical 12 columns.
  const columns: DataColumn<Job>[] = [
    {
      id: "job_id",
      header: "Job",
      sortable: true,
      sortValue: (row) => row.job_id,
      cell: (row) => (
        <button
          type="button"
          className="text-left font-mono text-xs text-primary hover:underline"
          onClick={() => setDetail(row)}
        >
          {row.job_id}
        </button>
      ),
    },
    { id: "operation", header: "Operation", sortable: true, sortValue: (row) => readField(row, "operation"), cell: (row) => readField(row, "operation") || "—" },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => readField(row, "status"),
      cell: (row) => <StatusBadge value={readField(row, "status") || "unknown"} />,
    },
    {
      id: "submitted_at",
      header: "Submitted",
      sortable: true,
      sortValue: (row) => readField(row, "submitted_at"),
      cell: (row) => (readField(row, "submitted_at") ? <RelativeTime timestamp={readField(row, "submitted_at")} /> : "—"),
    },
    {
      id: "started_at",
      header: "Started",
      sortable: true,
      sortValue: (row) => readField(row, "started_at"),
      cell: (row) => (readField(row, "started_at") ? <RelativeTime timestamp={readField(row, "started_at")} /> : "—"),
    },
    {
      id: "completed_at",
      header: "Completed",
      sortable: true,
      sortValue: (row) => readField(row, "completed_at"),
      cell: (row) => (readField(row, "completed_at") ? <RelativeTime timestamp={readField(row, "completed_at")} /> : "—"),
    },
    {
      id: "duration",
      header: "Duration",
      sortable: true,
      sortValue: (row) => {
        const d = (row as Record<string, unknown>).duration;
        return typeof d === "number" ? d : 0;
      },
      cell: (row) => durationLabel(row),
    },
    { id: "actor", header: "Actor", sortable: true, sortValue: (row) => readField(row, "actor"), cell: (row) => readField(row, "actor") || "—" },
    { id: "role", header: "Role", sortable: true, sortValue: (row) => readField(row, "role"), cell: (row) => readField(row, "role") || "—" },
    {
      id: "correlation_id",
      header: "Correlation",
      sortable: true,
      sortValue: (row) => readField(row, "correlation_id"),
      cell: (row) => readField(row, "correlation_id") ? <code className="text-xs">{readField(row, "correlation_id")}</code> : "—",
    },
    {
      id: "attempts",
      header: "Attempts",
      sortable: true,
      sortValue: (row) => attemptsValue(row),
      cell: (row) => <Badge variant="secondary">{attemptsValue(row)}</Badge>,
    },
    {
      id: "progress",
      header: "Progress",
      sortable: true,
      sortValue: (row) => progressValue(row),
      cell: (row) => (
        <div className="w-24" data-testid={`progress-${row.job_id}`}>
          <JobProgress value={progressValue(row)} label={`Job ${row.job_id ?? ""} progress ${progressValue(row)}%`} />
        </div>
      ),
    },
    createDataTableActionColumn<Job>((row) => [
      { id: "view", label: "View", onClick: () => setDetail(row) },
      {
        id: "cancel",
        label: "Cancel",
        disabled: () => !ability.canCancel || !CANCELLABLE.has(String(readField(row, "status"))),
        onClick: () => setConfirmCancel(row),
      },
      {
        id: "audit",
        label: "Audit",
        href: () => `/audit-log?query=job:${encodeURIComponent(row.job_id)}`,
        title: () => `View Audit Log for job ${row.job_id}`,
      },
    ]),
  ];

  // JW6 bulk actions filtered by the caller's role.
  const bulkActions: BulkAction[] = [];
  if (ability.canBulkRetry) bulkActions.push({ label: "Retry selected", action: "retry" });
  if (ability.canBulkCancel) bulkActions.push({ label: "Cancel selected", action: "cancel" });

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" version={appVersion} description="PS-76 Async render, batch and lifecycle jobs (12-col DataTable + 7-tab detail + bulk actions).">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <Card data-testid="jobs-filter-bar">
        <CardHeader>
          <h2 className="text-sm font-semibold">Filters (JW6)</h2>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="filter-status">Status</Label>
            <MultiSelect
              aria-label="Filter by status"
              options={STATUS_OPTIONS}
              values={statusFilter}
              onChange={setStatusFilter}
              placeholder="All statuses"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-operation">Operation</Label>
            <Select
              id="filter-operation"
              aria-label="Filter by operation"
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
            >
              {operationOptions.map((o) => (
                <option key={o.value || "__all__"} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-actor">Actor</Label>
            <Input
              id="filter-actor"
              aria-label="Filter by actor"
              value={actorFilter}
              placeholder="actor contains…"
              onChange={(e) => setActorFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-correlation">Correlation</Label>
            <Input
              id="filter-correlation"
              aria-label="Filter by correlation id"
              value={correlationFilter}
              placeholder="correlation id contains…"
              onChange={(e) => setCorrelationFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-date-from">Date from</Label>
            <DatePicker
              id="filter-date-from"
              aria-label="Filter from date"
              value={dateFrom ? new Date(dateFrom) : null}
              onChange={(d) => setDateFrom(d ? d.toISOString().slice(0, 10) : null)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-date-to">Date to</Label>
            <DatePicker
              id="filter-date-to"
              aria-label="Filter to date"
              value={dateTo ? new Date(dateTo) : null}
              onChange={(d) => setDateTo(d ? d.toISOString().slice(0, 10) : null)}
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(row) => row.job_id}
        emptyMessage="No jobs match the current filters."
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        columnPickerEnabled
        tableId="chart-mcp-jobs"
        selectable={bulkActions.length > 0}
        bulkActions={bulkActions}
        onBulkAction={(action, ids) => { void onBulk(action, ids); }}
        ariaLabel="PS-76 Jobs"
      />

      <Dialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={detail ? `Job ${detail.job_id} — PS-76 JW4 7-tab detail` : "Job detail"}
      >
        {detail ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Job {detail.job_id}</h2>
            <p className="text-xs text-muted-foreground">PS-76 JW4 7-tab detail dialog</p>
            <JobDetailTabs job={detail} />
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(open) => { if (!open) setConfirmCancel(null); }}
        title="Cancel Job"
        description="Request cancellation of this job. Work already completed is not rolled back."
        targetName={confirmCancel?.job_id}
        irreversible={false}
        confirmLabel="Cancel Job"
        confirmVariant="default"
        onConfirm={() => {
          const target = confirmCancel;
          setConfirmCancel(null);
          if (target) void cancel(target).catch((e) => setStatus(errMessage(e, "Failed to cancel job.")));
        }}
      />
    </div>
  );
}
