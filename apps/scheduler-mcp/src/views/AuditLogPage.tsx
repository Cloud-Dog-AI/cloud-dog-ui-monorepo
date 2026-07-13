// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1404b — Audit log page (PS-77 canonical: DataTable + EntityDialog + JsonExplorer).

import * as React from "react";
import {
  DataTable,
  DiagnosticsHealthPanel,
  EntityDialog,
  JsonExplorer,
  RelativeTime,
  StatusBadge,
  type DataColumn,
  type DiagnosticsHealthItem,
} from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { ErrorBanner, PageHeader } from "../lib/ui";
import type { AuditEventDto } from "../lib/types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

// PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): probe the scheduler service
// health surface for the diagnostics panel, mapped to ok/warning/error/unknown.
function probeStatus(resolved: Record<string, unknown> | null, failed: boolean): DiagnosticsHealthItem["status"] {
  if (failed) return "error";
  if (!resolved) return "unknown";
  const raw = String(resolved.status ?? resolved.state ?? "").toLowerCase();
  if (raw.includes("degrad") || raw.includes("warn") || raw.includes("partial")) return "warning";
  if (raw.includes("fail") || raw.includes("error") || raw.includes("down")) return "error";
  return "ok";
}

function useSchedulerHealth(probe: () => Promise<unknown>) {
  const [health, setHealth] = React.useState<DiagnosticsHealthItem[]>([{ name: "API", status: "unknown" }]);
  const [healthError, setHealthError] = React.useState<string | null>(null);
  const refreshHealth = React.useCallback(async () => {
    setHealthError(null);
    try {
      const res = (await probe()) as Record<string, unknown> | null;
      setHealth([{ name: "API", status: probeStatus(res, false) }]);
    } catch {
      setHealth([{ name: "API", status: "error", detail: "Health probe failed" }]);
    }
  }, [probe]);
  React.useEffect(() => { void refreshHealth(); }, [refreshHealth]);
  return { health, healthError, refreshHealth };
}

export function AuditLogPage() {
  const { api } = useAppState();
  const { health, healthError, refreshHealth } = useSchedulerHealth(() => api.health());
  const [rows, setRows] = React.useState<AuditEventDto[]>([]);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(25);
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");

  const [actor, setActor] = React.useState("");
  const [action, setAction] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [corrId, setCorrId] = React.useState("");

  const [selected, setSelected] = React.useState<AuditEventDto | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listAudit({
        actor_id: actor || undefined,
        action: action || undefined,
        outcome: outcome || undefined,
        correlation_id: corrId || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order,
      });
      setRows([...r.items]);
      setTotal(r.total);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [api, actor, action, outcome, corrId, page, pageSize, order]);

  React.useEffect(() => { void load(); }, [load]);

  const columns: DataColumn<AuditEventDto>[] = React.useMemo(() => [
    {
      id: "time",
      header: "Time",
      cell: (r) => (r.timestamp ? <RelativeTime timestamp={r.timestamp} /> : "—"),
      sortable: true,
      sortValue: (r) => r.timestamp ?? "",
    },
    {
      id: "actor",
      header: "Actor",
      cell: (r) => <code className="text-xs">{r.actor?.id ?? "—"}</code>,
      sortable: true,
      sortValue: (r) => r.actor?.id ?? "",
    },
    {
      id: "action",
      header: "Action",
      cell: (r) => r.action ?? "—",
      sortable: true,
      sortValue: (r) => r.action ?? "",
    },
    {
      id: "outcome",
      header: "Outcome",
      cell: (r) => (r.outcome ? <StatusBadge value={r.outcome} /> : "—"),
      sortable: true,
      sortValue: (r) => r.outcome ?? "",
    },
    {
      id: "target",
      header: "Target",
      cell: (r) => <code className="text-xs">{r.target?.name ?? r.target?.id ?? "—"}</code>,
    },
    {
      id: "correlation",
      header: "Correlation ID",
      cell: (r) => <code className="text-xs">{r.correlation_id ?? "—"}</code>,
    },
    {
      id: "duration",
      header: "Duration (ms)",
      cell: (r) => (r.duration_ms != null ? r.duration_ms : "—"),
      sortable: true,
      sortValue: (r) => r.duration_ms ?? -1,
    },
    {
      id: "view",
      header: "",
      cell: (r) => (
        <button
          type="button"
          data-testid={`audit-row-view-${r.event_id}`}
          className="rounded border px-2 py-0.5 text-xs"
          onClick={() => setSelected(r)}
        >View</button>
      ),
    },
  ], []);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 space-y-4" data-testid="audit-log-page">
      <PageHeader title="Audit log" description="PS-40 audit events emitted by this service (W28K-1404b)" />
      <ErrorBanner error={error} />

      {/* PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): diagnostics / health /
          resource-metrics panel above the PS-40 audit table. */}
      <DiagnosticsHealthPanel
        title="System diagnostics"
        description="Live resource metrics and service health for the scheduler service."
        metricsUrl="/status"
        metricsIntervalMs={30_000}
        health={health}
        error={healthError}
        onRefresh={refreshHealth}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="search" aria-label="Audit filters">
        <label className="text-xs">
          Actor
          <input data-testid="audit-filter-actor" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} placeholder="actor id substring" />
        </label>
        <label className="text-xs">
          Action
          <input data-testid="audit-filter-action" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="exact action" />
        </label>
        <label className="text-xs">
          Outcome
          <select data-testid="audit-filter-outcome" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
            <option value="">(any)</option>
            <option value="success">success</option>
            <option value="denied">denied</option>
            <option value="error">error</option>
          </select>
        </label>
        <label className="text-xs">
          Correlation ID
          <input data-testid="audit-filter-corrid" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={corrId} onChange={(e) => { setCorrId(e.target.value); setPage(1); }} placeholder="exact correlation_id" />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="audit-filter-reset" className="rounded border px-2 py-1 text-xs" onClick={() => { setActor(""); setAction(""); setOutcome(""); setCorrId(""); setPage(1); }}>Reset</button>
          <button type="button" data-testid="audit-filter-refresh" className="rounded border px-2 py-1 text-xs" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {loading ? (
        <div role="status">Loading...</div>
      ) : (
        <>
          <DataTable<AuditEventDto>
            columns={columns}
            rows={rows}
            totalRows={total}
            getRowId={(r) => r.event_id}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            tableId="scheduler-audit"
            emptyMessage="No audit events match the current filters."
          />
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground" data-testid="audit-pagination">
            <span data-testid="audit-total">Total Records: {total}</span>
            <div className="flex items-center gap-2">
              <select data-testid="audit-page-size" className="rounded border px-1 py-0.5 text-xs" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Page size">
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select data-testid="audit-order" className="rounded border px-1 py-0.5 text-xs" value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")} aria-label="Order">
                <option value="desc">desc</option>
                <option value="asc">asc</option>
              </select>
              <button className="rounded border px-2 py-1 text-xs disabled:opacity-40" data-testid="audit-prev" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}>Prev</button>
              <span>Page {page} of {pageCount}</span>
              <button className="rounded border px-2 py-1 text-xs disabled:opacity-40" data-testid="audit-next" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}

      {selected ? (
        <EntityDialog
          open={true}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          title={`Audit event ${selected.event_id}`}
          body={
            <div data-testid="audit-event-detail" className="space-y-3">
              <div className="text-xs text-muted-foreground">{selected.timestamp}</div>
              <div className="flex gap-2">
                <button type="button" data-testid="audit-copy-corrid" className="rounded border px-2 py-1 text-xs" onClick={() => { void navigator.clipboard.writeText(selected.correlation_id ?? ""); }}>Copy correlation_id</button>
                <button type="button" data-testid="audit-copy-json" className="rounded border px-2 py-1 text-xs" onClick={() => { void navigator.clipboard.writeText(JSON.stringify(selected, null, 2)); }}>Copy event JSON</button>
              </div>
              <JsonExplorer data={selected as unknown as Record<string, unknown>} defaultExpanded />
            </div>
          }
        />
      ) : null}
    </div>
  );
}
