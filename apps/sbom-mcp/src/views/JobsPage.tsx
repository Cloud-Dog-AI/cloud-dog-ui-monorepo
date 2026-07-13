// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import {
  Button,
  DataTable,
  EntityDialog,
  JsonBlock,
  Select,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { retryScanRequestFromJob } from "../lib/api";
import type { JobResponse } from "../lib/types";

const CANONICAL_JOB_STATES = [
  "Queued",
  "Running",
  "Succeeded",
  "Failed",
  "Cancelled",
  "Timeout",
  "Dead-lettered",
] as const;

type CanonicalJobState = (typeof CANONICAL_JOB_STATES)[number];

function scanIdForJob(row: JobResponse): string | null {
  const value = row.payload.scan_id;
  return typeof value === "string" && value ? value : null;
}

function canonicalJobState(status: string): CanonicalJobState {
  const normalized = status.toLowerCase().replace(/[-\s]/g, "_");
  if (["queued", "pending", "retry_wait", "scheduled"].includes(normalized)) return "Queued";
  if (["running", "claimed", "started", "in_progress"].includes(normalized)) return "Running";
  if (["succeeded", "success", "completed", "completed_pass", "completed_fail"].includes(normalized)) return "Succeeded";
  if (["failed", "error", "infra_failed"].includes(normalized)) return "Failed";
  if (["cancelled", "canceled", "cancel_requested"].includes(normalized)) return "Cancelled";
  if (["timeout", "timed_out", "expired"].includes(normalized)) return "Timeout";
  if (["dead_lettered", "dead_letter", "dlq"].includes(normalized)) return "Dead-lettered";
  return "Queued";
}

function stateTone(state: CanonicalJobState): string {
  if (state === "Succeeded") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (state === "Failed" || state === "Timeout" || state === "Dead-lettered") {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }
  if (state === "Running" || state === "Queued") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function isCancellable(row: JobResponse): boolean {
  return ["Queued", "Running"].includes(canonicalJobState(row.status)) && Boolean(scanIdForJob(row));
}

function isRetryable(row: JobResponse): boolean {
  return ["Failed", "Timeout", "Dead-lettered"].includes(canonicalJobState(row.status)) &&
    retryScanRequestFromJob(row) !== null;
}

export function JobsPage() {
  const { api, appVersion } = useSbomState();
  const [rows, setRows] = React.useState<JobResponse[]>([]);
  const [state, setState] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<JobResponse | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listJobs(200);
      setRows(result.items);
    } catch (e) {
      setError(errMessage(e, "Failed to load jobs."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const cancel = async (row: JobResponse) => {
    const scanId = scanIdForJob(row);
    if (!scanId) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancelScan(scanId);
      setNotice(`Cancel requested for job ${row.job_id}`);
      await load();
    } catch (e) {
      setError(errMessage(e, "Failed to cancel job scan."));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (row: JobResponse) => {
    setBusy(true);
    setError(null);
    try {
      const resp = await api.retryJob(row);
      setNotice(`Retry submitted as job ${resp.job_id}`);
      await load();
    } catch (e) {
      setError(errMessage(e, "Failed to retry job scan."));
    } finally {
      setBusy(false);
    }
  };

  const filtered = React.useMemo(
    () => rows.filter((row) => !state || canonicalJobState(row.status) === state),
    [rows, state]
  );
  const states = CANONICAL_JOB_STATES.filter((item) =>
    rows.some((row) => canonicalJobState(row.status) === item)
  );

  const columns: DataColumn<JobResponse>[] = [
    { id: "job_id", header: "Job", sortable: true, sortValue: (r) => r.job_id, cell: (r) => <span className="font-mono text-xs">{r.job_id}</span> },
    { id: "job_type", header: "Type", sortable: true, sortValue: (r) => r.job_type, cell: (r) => r.job_type },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => canonicalJobState(r.status),
      cell: (r) => {
        const label = canonicalJobState(r.status);
        return (
          <span
            data-testid={`job-state-${r.job_id}`}
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${stateTone(label)}`}
          >
            {label}
          </span>
        );
      },
    },
    { id: "attempt", header: "Attempts", sortable: true, sortValue: (r) => r.attempt, cell: (r) => r.attempt },
    {
      id: "scan_id",
      header: "Scan",
      sortable: true,
      sortValue: (r) => scanIdForJob(r) ?? "",
      cell: (r) => (
        <a className="font-mono text-xs text-primary underline" href={`/scans/${scanIdForJob(r) ?? r.job_id}`}>
          {scanIdForJob(r) ?? "—"}
        </a>
      ),
    },
    { id: "user_id", header: "User", sortable: true, sortValue: (r) => r.user_id ?? "", cell: (r) => r.user_id ?? "—" },
    { id: "created_at", header: "Created", sortable: true, sortValue: (r) => r.created_at, cell: (r) => <span className="text-xs text-muted-foreground">{r.created_at}</span> },
    { id: "updated_at", header: "Updated", sortable: true, sortValue: (r) => r.updated_at, cell: (r) => <span className="text-xs text-muted-foreground">{r.updated_at}</span> },
    createDataTableActionColumn<JobResponse>((row) => [
      {
        id: "detail",
        label: "Detail",
        onClick: () => setSelected(row),
      },
      {
        id: "cancel",
        label: "Cancel",
        destructive: true,
        disabled: () => busy || !isCancellable(row),
        onClick: () => void cancel(row),
      },
      {
        id: "retry",
        label: "Retry",
        disabled: () => busy || !isRetryable(row),
        onClick: () => void retry(row),
      },
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        version={appVersion}
        description="Asynchronous scan jobs with retry count and cancel request where the scan is cancellable."
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </PageHeader>
      <div className="max-w-xs">
        <Select aria-label="Filter job status" value={state} onChange={(event) => setState(event.currentTarget.value)}>
          <option value="">Any status</option>
          {states.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </div>
      <StatusLine loading={loading} error={error} status={notice ?? `${filtered.length} jobs visible`} />
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(r) => r.job_id}
        getRowTestId={(r) => `job-row-${r.job_id}`}
        emptyMessage="No jobs match the current filters."
        pageSize={25}
        columnPickerEnabled
        tableId="sbom-mcp-jobs"
      />
      <EntityDialog
        open={selected !== null}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        title={selected ? `Job ${selected.job_id}` : "Job detail"}
        body={
          selected ? (
            <div className="space-y-4" data-testid="job-detail-dialog">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Job ID</dt>
                <dd className="font-mono text-xs">{selected.job_id}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{selected.job_type}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{canonicalJobState(selected.status)}</dd>
                <dt className="text-muted-foreground">Attempts</dt>
                <dd>{selected.attempt}</dd>
                <dt className="text-muted-foreground">Actor</dt>
                <dd>{selected.user_id ?? "—"}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-xs">{selected.created_at}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-xs">{selected.updated_at}</dd>
              </dl>
              <JsonBlock
                title="Raw job record"
                value={selected as unknown as Record<string, unknown>}
                defaultCollapsed={false}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
}
