// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1423 / W28K-1404f — Registry page (PS-77 canonical DataTable).

import * as React from "react";
import { DataTable, StatusBadge, type DataColumn } from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { ErrorBanner, PageHeader } from "../lib/ui";
import type { RegistryProjectDto } from "../lib/types";

export function RegistryPage() {
  const { api } = useAppState();
  const [rows, setRows] = React.useState<RegistryProjectDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api.listRegistryProjects();
        if (!cancelled) setRows(Array.isArray(r?.items) ? [...r.items] : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const columns: DataColumn<RegistryProjectDto>[] = React.useMemo(() => [
    { id: "project", header: "Project", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
    { id: "kind", header: "Kind", cell: (r) => <code className="text-xs">{r.service_kind}</code>, sortable: true, sortValue: (r) => r.service_kind },
    { id: "url", header: "Base URL", cell: (r) => <code className="text-xs">{r.base_url}</code> },
    { id: "enabled", header: "Enabled", cell: (r) => r.enabled ? "yes" : "no", sortable: true, sortValue: (r) => r.enabled ? 1 : 0 },
    { id: "health", header: "Health", cell: (r) => r.last_health_status ? <StatusBadge value={r.last_health_status} /> : "—" },
  ], []);

  return (
    <div data-testid="scheduler-registry-page" className="p-6">
      <PageHeader title="Project registry" description="Discoverable scheduling targets (W28K-1406)" />
      <ErrorBanner error={error} />
      {loading ? <div role="status">Loading...</div> : (
        <>
          <DataTable<RegistryProjectDto>
            columns={columns}
            rows={rows}
            totalRows={rows.length}
            getRowId={(r) => r.project_id}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            tableId="scheduler-registry"
            emptyMessage="No projects registered."
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
    </div>
  );
}
