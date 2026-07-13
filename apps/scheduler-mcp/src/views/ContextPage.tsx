// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1423 — Context store browser (PS-77 canonical).

import * as React from "react";
import { Button, DataTable, EntityDialog, Input, JsonExplorer, RelativeTime, type DataColumn } from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { ErrorBanner, PageHeader } from "../lib/ui";
import type { ContextEntryDto } from "../lib/types";

export function ContextPage() {
  const { api } = useAppState();
  const [scopeType, setScopeType] = React.useState("schedule_run");
  const [scopeId, setScopeId] = React.useState("");
  const [rows, setRows] = React.useState<ReadonlyArray<ContextEntryDto>>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dialog, setDialog] = React.useState<ContextEntryDto | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const load = async () => {
    if (!scopeType || !scopeId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.listContext(scopeType, scopeId);
      setRows(r.items);
    } catch (e: any) { setError(e?.message ?? String(e)); }
    finally { setLoading(false); }
  };

  const columns = React.useMemo<DataColumn<ContextEntryDto>[]>(() => [
    { id: "key", header: "Key", cell: (r) => <code className="text-xs">{r.key}</code>, sortable: true, sortValue: (r) => r.key },
    { id: "type", header: "Type", cell: (r) => <code className="text-xs">{r.value_type}</code> },
    { id: "visibility", header: "Visibility", cell: (r) => r.visibility },
    { id: "value", header: "Value", cell: (r) => <code className="text-xs">{JSON.stringify(r.value).slice(0, 80)}</code> },
    { id: "updated", header: "Updated", cell: (r) => r.updated_at ? <RelativeTime timestamp={r.updated_at} /> : "—", sortable: true, sortValue: (r) => r.updated_at ?? "" },
  ], []);

  return (
    <div data-testid="scheduler-context-page" className="p-6">
      <PageHeader title="Context store" description="Scoped key/value persistence (W28K-1419)" />
      <ErrorBanner error={error} />
      <div className="mb-3 grid gap-2 md:grid-cols-3">
        <label className="text-sm">Scope type
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900">
            {["global_service", "tenant", "group", "user", "schedule", "schedule_run", "chain_run", "job_run"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">Scope id
          <Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="mt-1 block w-full font-mono" />
        </label>
        <div className="flex items-end"><Button onClick={() => void load()}>Load</Button></div>
      </div>
      {loading ? <div role="status">Loading...</div> : (
        <>
          <DataTable<ContextEntryDto>
            columns={columns}
            rows={rows as ContextEntryDto[]}
            totalRows={rows.length}
            getRowId={(r) => r.context_entry_id}
            page={page} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={setPageSize}
            tableId="scheduler-context"
            emptyMessage="No entries for this scope."
          />
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
            <span>Total Records: {rows.length}</span>
            <div className="flex items-center gap-2">
              <select className="rounded border px-1 py-0.5 text-xs" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Page size">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select>
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
          title={`Context ${dialog.key ?? ""}`}
          body={<JsonExplorer data={dialog.value as Record<string, unknown>} />}
        />
      ) : null}
    </div>
  );
}
