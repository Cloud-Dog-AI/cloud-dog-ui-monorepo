// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1423 — Schedules CRUD page (PS-77 canonical: DataTable + EntityDialog).
// W28K-1408 F-1408-2 — edit-mode dialog (EntityDialog mode="edit" -> patchSchedule).
// W28K-1408 F-1408-3 — scope-aware CTA hide/show (can("schedules.write")).

import * as React from "react";
import {
  Button,
  DataTable,
  EntityDialog,
  RelativeTime,
  StatusBadge,
  type DataColumn,
} from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { ErrorBanner, PageHeader } from "../lib/ui";
import { SCOPES } from "../lib/rbac";
import type { ScheduleDto } from "../lib/types";

const FIELDS = [
  { name: "name", label: "Name", type: "text" as const, required: true },
  { name: "trigger_type", label: "Trigger type", type: "select" as const, required: true,
    options: ["cron", "interval", "one_shot", "manual"] },
  { name: "trigger_spec", label: "Trigger spec (JSON)", type: "textarea" as const, required: true,
    placeholder: '{"cron": "*/5 * * * *"}' },
  { name: "target_type", label: "Target type", type: "select" as const, required: true,
    options: ["registered_tool", "external_http", "code_runner", "sandbox_command", "chain"] },
  { name: "target_ref", label: "Target ref", type: "text" as const, required: true,
    placeholder: "imap-mcp.list_messages" },
];

// In edit mode target_type is immutable (SchedulePatch does not accept it); show
// it read-only so the operator sees the binding without being able to break it.
const EDIT_FIELDS = FIELDS.map((f) => (f.name === "target_type" ? { ...f, readOnly: true } : f));

type DialogState = { mode: "add" | "view" | "edit"; row?: ScheduleDto } | null;

function rowToValues(row: ScheduleDto): Record<string, unknown> {
  return {
    name: row.name ?? "",
    trigger_type: row.trigger_type ?? "",
    trigger_spec: JSON.stringify(row.trigger_spec ?? {}),
    target_type: row.target_type ?? "",
    target_ref: row.target_ref ?? "",
  };
}

export function SchedulesPage() {
  const { api, can } = useAppState();
  const canWrite = can(SCOPES.write);
  const canRunNow = can(SCOPES.runNow);
  const [rows, setRows] = React.useState<ScheduleDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const runNow = React.useCallback(async (row: ScheduleDto) => {
    setError(null);
    try {
      const res = await api.triggerRun(row.schedule_id);
      setStatus(`Triggered ${row.name} — run ${res.run_id}.`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [api]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listSchedules();
      setRows(Array.isArray(r?.items) ? [...r.items] : []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openEdit = React.useCallback((row: ScheduleDto) => {
    setError(null);
    setValues(rowToValues(row));
    setDialog({ mode: "edit", row });
  }, []);

  const columns = React.useMemo<DataColumn<ScheduleDto>[]>(() => [
    { id: "name", header: "Name", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
    { id: "trigger", header: "Trigger", cell: (r) => (<code className="text-xs">{r.trigger_type}</code>), sortable: true, sortValue: (r) => r.trigger_type },
    { id: "target", header: "Target", cell: (r) => (<code className="text-xs">{r.target_ref}</code>) },
    {
      id: "next",
      header: "Next fire",
      cell: (r) => (r.next_fire_at ? <RelativeTime timestamp={r.next_fire_at} /> : "—"),
      sortable: true,
      sortValue: (r) => r.next_fire_at ?? "",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <StatusBadge value={r.paused ? "paused" : r.status} />,
      sortable: true,
      sortValue: (r) => (r.paused ? "paused" : r.status),
    },
    {
      id: "created",
      header: "Created",
      cell: (r) => (r.created_at ? <RelativeTime timestamp={r.created_at} /> : "—"),
      sortable: true,
      sortValue: (r) => r.created_at ?? "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs text-sky-700 hover:underline"
            data-testid={`schedule-view-${r.schedule_id}`}
            onClick={() => { setValues(rowToValues(r)); setDialog({ mode: "view", row: r }); }}
          >
            View
          </button>
          {canWrite ? (
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              data-testid={`schedule-edit-${r.schedule_id}`}
              onClick={() => openEdit(r)}
            >
              Edit
            </button>
          ) : null}
          {canRunNow ? (
            <button
              type="button"
              className="text-xs text-emerald-700 hover:underline"
              data-testid={`schedule-run-${r.schedule_id}`}
              onClick={() => void runNow(r)}
            >
              Run now
            </button>
          ) : null}
        </div>
      ),
    },
  ], [canWrite, canRunNow, openEdit, runNow]);

  const parseSpec = (): Record<string, unknown> | null => {
    try {
      return JSON.parse(String(values.trigger_spec || "{}"));
    } catch (e: any) {
      setError(`Invalid trigger_spec JSON: ${e.message}`);
      return null;
    }
  };

  const onCreate = async () => {
    setError(null);
    const trigger_spec = parseSpec();
    if (trigger_spec === null) return;
    try {
      await api.createSchedule({
        name: String(values.name),
        trigger_type: String(values.trigger_type),
        trigger_spec,
        target_type: String(values.target_type),
        target_ref: String(values.target_ref),
      });
      setDialog(null);
      setValues({});
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const onUpdate = async () => {
    if (!dialog?.row) return;
    setError(null);
    const trigger_spec = parseSpec();
    if (trigger_spec === null) return;
    try {
      // SchedulePatch accepts name/trigger_type/trigger_spec/target_ref (target_type
      // is immutable). next_fire_at is recomputed server-side from the trigger.
      await api.patchSchedule(dialog.row.schedule_id, {
        name: String(values.name),
        trigger_type: String(values.trigger_type),
        trigger_spec,
        target_ref: String(values.target_ref),
      });
      setDialog(null);
      setValues({});
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const onBulkAction = async (action: string, ids: string[]) => {
    setError(null);
    try {
      if (action === "delete") for (const id of ids) await api.deleteSchedule(id);
      if (action === "pause") for (const id of ids) await api.patchSchedule(id, { paused: true });
      if (action === "resume") for (const id of ids) await api.patchSchedule(id, { paused: false });
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const bulkActions = canWrite
    ? [
        { label: "Pause", action: "pause" },
        { label: "Resume", action: "resume" },
        { label: "Delete", action: "delete" },
      ]
    : [];

  return (
    <div data-testid="scheduler-schedules-page" className="p-6">
      <PageHeader
        title="Schedules"
        description="cron / interval / one_shot / manual triggers (W28K-1415)"
        actions={
          canWrite ? (
            <Button onClick={() => { setValues({ trigger_type: "cron", target_type: "registered_tool", trigger_spec: '{"cron": "*/5 * * * *"}' }); setDialog({ mode: "add" }); }} data-testid="cta-new-schedule">
              New schedule
            </Button>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />
      {status ? <p role="status" className="mb-3 text-sm text-emerald-700" data-testid="schedule-status">{status}</p> : null}
      {loading ? (
        <div role="status">Loading...</div>
      ) : (
        <>
          <DataTable<ScheduleDto>
            columns={columns}
            rows={rows}
            totalRows={rows.length}
            getRowId={(r) => r.schedule_id}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectable={canWrite}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            tableId="scheduler-schedules"
            emptyMessage="No schedules yet — click 'New schedule' to create one."
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
          onOpenChange={(o) => { if (!o) { setDialog(null); setValues({}); } }}
          title={
            dialog.mode === "view" ? `Schedule ${dialog.row?.name ?? ""}`
            : dialog.mode === "edit" ? `Edit ${dialog.row?.name ?? ""}`
            : "New schedule"
          }
          fields={dialog.mode === "edit" ? EDIT_FIELDS : FIELDS}
          values={values}
          onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
          onSubmit={dialog.mode === "add" ? onCreate : dialog.mode === "edit" ? onUpdate : () => setDialog(null)}
          onCancel={() => { setDialog(null); setValues({}); }}
          mode={dialog.mode}
          submitLabel={dialog.mode === "add" ? "Create" : dialog.mode === "edit" ? "Save" : "Close"}
        />
      ) : null}
    </div>
  );
}
