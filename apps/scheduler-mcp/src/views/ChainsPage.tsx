// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1423 — Chains CRUD page (PS-77 canonical).

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
import type { ChainDto } from "../lib/types";

const DEFAULT_DEFINITION = JSON.stringify(
  { steps: [
    { step_id: "a", type: "http", config: { url: "https://example.invalid/probe" } },
    { step_id: "b", type: "wait", config: { seconds: 5 }, needs: ["a"] },
  ] }, null, 2,
);

const FIELDS = [
  { name: "name", label: "Name", type: "text" as const, required: true },
  { name: "description", label: "Description", type: "textarea" as const, rows: 2 },
  { name: "definition", label: "Definition (JSON)", type: "textarea" as const, required: true, rows: 10 },
];

export function ChainsPage() {
  const { api, can } = useAppState();
  const canWrite = can(SCOPES.write);
  const [rows, setRows] = React.useState<ChainDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<{ mode: "add" | "view"; row?: ChainDto } | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listChains();
      setRows(Array.isArray(r?.items) ? [...r.items] : []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => { void load(); }, [load]);

  const columns = React.useMemo<DataColumn<ChainDto>[]>(() => [
    { id: "name", header: "Name", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
    { id: "version", header: "Version", cell: (r) => <code className="text-xs">v{r.version}</code>, sortable: true, sortValue: (r) => r.version },
    { id: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} />, sortable: true, sortValue: (r) => r.status },
    { id: "created", header: "Created", cell: (r) => r.created_at ? <RelativeTime timestamp={r.created_at} /> : "—", sortable: true, sortValue: (r) => r.created_at ?? "" },
  ], []);

  const onCreate = async () => {
    setError(null);
    let definition: Record<string, unknown> = {};
    try { definition = JSON.parse(String(values.definition || "{}")); }
    catch (e: any) { setError(`Definition is not valid JSON: ${e.message}`); return; }
    try {
      await api.createChain({ name: String(values.name), definition });
      setDialog(null); setValues({}); await load();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  };

  const onBulkAction = async (action: string, ids: string[]) => {
    setError(null);
    try {
      if (action === "delete") for (const id of ids) await api.deleteChain(id);
      await load();
    } catch (e: any) { setError(e?.message ?? String(e)); }
  };

  return (
    <div data-testid="scheduler-chains-page" className="p-6">
      <PageHeader
        title="Chains"
        description="DAG-compiled multi-step workflows (W28K-1417/1418)"
        actions={
          canWrite ? (
            <Button onClick={() => { setValues({ definition: DEFAULT_DEFINITION }); setDialog({ mode: "add" }); }} data-testid="cta-new-chain">
              New chain
            </Button>
          ) : undefined
        }
      />
      <ErrorBanner error={error} />
      {loading ? <div role="status">Loading...</div> : (
        <>
          <DataTable<ChainDto>
            columns={columns}
            rows={rows}
            totalRows={rows.length}
            getRowId={(r) => r.chain_id}
            page={page} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={setPageSize}

            tableId="scheduler-chains"
            emptyMessage="No chains yet."
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
          title={dialog.mode === "view" ? `Chain ${dialog.row?.name ?? ""}` : "New chain"}
          fields={FIELDS}
          values={dialog.mode === "view" ? {
            name: dialog.row?.name ?? "",
            description: dialog.row?.description ?? "",
            definition: JSON.stringify(dialog.row?.definition ?? {}, null, 2),
          } : values}
          onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
          onSubmit={dialog.mode === "add" ? onCreate : () => setDialog(null)}
          onCancel={() => { setDialog(null); setValues({}); }}
          mode={dialog.mode === "view" ? "view" : "add"}
          submitLabel={dialog.mode === "add" ? "Create" : "Close"}
        />
      ) : null}
    </div>
  );
}
