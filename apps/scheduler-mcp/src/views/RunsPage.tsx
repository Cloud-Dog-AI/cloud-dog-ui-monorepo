// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1423 — Runs page (PS-77 canonical).

import * as React from "react";
import {
  Button,
  DataTable,
  EntityDialog,
  Input,
  RelativeTime,
  StatusBadge,
  type DataColumn,
} from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { ErrorBanner, PageHeader } from "../lib/ui";
import type { ScheduleRunDto } from "../lib/types";

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "skipped", "misfired"]);

export function RunsPage() {
  const { api } = useAppState();
  const [rows, setRows] = React.useState<ScheduleRunDto[]>([]);
  const [filter, setFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<ScheduleRunDto | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listRuns(filter ? { schedule_id: filter } : undefined);
      setRows(Array.isArray(r?.items) ? [...r.items] : []);
    } catch (e: any) { setError(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [api, filter]);

  React.useEffect(() => { void load(); }, [load]);

  const columns = React.useMemo<DataColumn<ScheduleRunDto>[]>(() => [
    { id: "run", header: "Run", cell: (r) => <code className="text-xs">{r.schedule_run_id}</code> },
    { id: "schedule", header: "Schedule", cell: (r) => <code className="text-xs">{r.schedule_id}</code>, sortable: true, sortValue: (r) => r.schedule_id },
    { id: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} />, sortable: true, sortValue: (r) => r.status },
    { id: "scheduled", header: "Scheduled for", cell: (r) => r.scheduled_for ? <RelativeTime timestamp={r.scheduled_for} /> : "—", sortable: true, sortValue: (r) => r.scheduled_for ?? "" },
    { id: "attempt", header: "Attempt", cell: (r) => r.attempt, sortable: true, sortValue: (r) => r.attempt },
  ], []);

  const onBulkAction = async (action: string, ids: string[]) => {
    setError(null);
    try {
      if (action === "cancel") for (const id of ids) {
        const row = rows.find((r) => r.schedule_run_id === id);
        if (row && !TERMINAL.has(row.status)) await api.cancelRun(id);
      }
      await load();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  };

  return (
    <div data-testid="scheduler-runs-page" className="p-6">
      <PageHeader
        title="Runs"
        description="Schedule-run lifecycle records (W28K-1416)"
        actions={<Button onClick={() => void load()}>Refresh</Button>}
      />
      <ErrorBanner error={error} />
      <div className="mb-3 flex gap-2 text-sm">
        <label className="flex-1">Filter by schedule_id
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-1 block w-full font-mono" placeholder="(empty for all)" />
        </label>
      </div>
      {loading ? <div role="status">Loading...</div> : (
        <>
          <DataTable<ScheduleRunDto>
            columns={columns}
            rows={rows}
            totalRows={rows.length}
            getRowId={(r) => r.schedule_run_id}
            page={page} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={setPageSize}

            tableId="scheduler-runs"
            emptyMessage="No runs match the current filter."
          />
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
            <span>Total Records: {rows.length}</span>
            <div className="flex items-center gap-2">
              <select className="rounded border px-1 py-0.5 text-xs" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Page size">
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="rounded border px-2 py-1 text-xs disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>Prev</button>
              <span>Page {page} of {Math.max(1, Math.ceil(rows.length / pageSize))}</span>
              <button className="rounded border px-2 py-1 text-xs disabled:opacity-40" disabled={page * pageSize >= rows.length} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
      {dialog !== null ? (
        <EntityDialog
          open={true}
          onOpenChange={(o) => { if (!o) setDialog(null); }}
          title={`Run ${dialog.schedule_run_id ?? ""}`}
          body={
            <div className="space-y-2 text-sm">
              <div><strong>Run ID:</strong> <code>{dialog.schedule_run_id}</code></div>
              <div><strong>Schedule:</strong> <code>{dialog.schedule_id}</code></div>
              <div><strong>Status:</strong> <StatusBadge value={dialog.status} /></div>
              <div><strong>Scheduled for:</strong> {dialog.scheduled_for}</div>
              <div><strong>Started:</strong> {dialog.started_at ?? "—"}</div>
              <div><strong>Finished:</strong> {dialog.finished_at ?? "—"}</div>
              <div><strong>Attempt:</strong> {dialog.attempt}</div>
              <div><strong>Error code:</strong> {dialog.error_code ?? "—"}</div>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
